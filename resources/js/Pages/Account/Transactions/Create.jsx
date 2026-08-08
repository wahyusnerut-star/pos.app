import React, { useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import LayoutAccount from "../../../Layouts/Account";
import Swal from "sweetalert2";
import { formatRupiah } from "../../../Utils/format";

export default function TransactionCreate() {
    const {
        products = { data: [], links: [] },
        carts = [],
        categories = [],
        customers = [],
        errors = {},
        flash = {},
    } = usePage().props;

    const params = new URLSearchParams(window.location.search);

    const [categoryId, setCategoryId] = useState(
        params.get("category_id") || "",
    );
    const [searchQuery, setSearchQuery] = useState(params.get("q") || "");
    const [customerId, setCustomerId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [discount, setDiscount] = useState(0);
    const [cash, setCash] = useState("");

    const subtotal = useMemo(
        () =>
            carts.reduce(
                (total, cart) =>
                    total + Number(cart.price || 0) * Number(cart.qty || 0),
                0,
            ),
        [carts],
    );

    const discountValue = Number(discount || 0);
    const grandTotal = Math.max(subtotal - discountValue, 0);
    const cashValue = Number(cash || 0);
    const change =
        paymentMethod === "cash" && cashValue >= grandTotal
            ? cashValue - grandTotal
            : 0;

    const cartQty = carts.reduce(
        (total, cart) => total + Number(cart.qty || 0),
        0,
    );

    const cashOptions = useMemo(() => {
        if (paymentMethod !== "cash" || grandTotal <= 0) {
            return [];
        }

        return [
            ...new Set(
                [
                    grandTotal,
                    Math.ceil(grandTotal / 10000) * 10000,
                    Math.ceil(grandTotal / 50000) * 50000,
                    50000,
                    100000,
                    200000,
                ].filter((value) => value >= grandTotal),
            ),
        ].slice(0, 4);
    }, [grandTotal, paymentMethod]);

    const visitProductList = (nextCategoryId, nextSearchQuery) => {
        const query = new URLSearchParams();
        const trimmedSearch = nextSearchQuery.trim();

        if (trimmedSearch) {
            query.set("q", trimmedSearch);
        }

        if (nextCategoryId) {
            query.set("category_id", nextCategoryId);
        }

        router.get(
            `/account/transactions/create${query.toString() ? `?${query.toString()}` : ""}`,
            {},
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleSearch = (e) => {
        e.preventDefault();

        visitProductList(categoryId, searchQuery);
    };

    const handleCategoryClick = (id) => {
        setCategoryId(id);

        visitProductList(id, searchQuery);
    };

    const addToCart = (productId) => {
        router.post(
            "/account/carts",
            { product_id: productId },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const updateCart = (cartId, newQty) => {
        if (newQty < 1) {
            deleteCart(cartId);
            return;
        }

        router.put(
            `/account/carts/${cartId}`,
            { qty: newQty },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const deleteCart = (cartId) => {
        router.delete(`/account/carts/${cartId}`, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const openMidtransPopup = (snapToken, invoice) => {
        if (!window.snap) {
            Swal.fire(
                "Error!",
                "Snap JS Midtrans belum siap. Pastikan script Snap sudah ditambahkan di app.blade.php.",
                "error",
            );
            return;
        }

        window.snap.pay(snapToken, {
            onSuccess: function () {
                router.get(`/account/transactions/${invoice}`);
            },
            onPending: function () {
                router.get(`/account/transactions/${invoice}`);
            },
            onError: function () {
                Swal.fire(
                    "Error!",
                    "Pembayaran digital gagal diproses.",
                    "error",
                );
            },
            onClose: function () {
                Swal.fire({
                    title: "Pembayaran Belum Selesai",
                    text: "Transaksi sudah dibuat dengan status pending.",
                    icon: "info",
                    timer: 1800,
                    showConfirmButton: false,
                }).then(() => {
                    router.get(`/account/transactions/${invoice}`);
                });
            },
        });
    };

    const storeTransaction = (e) => {
        e.preventDefault();

        if (carts.length === 0) {
            Swal.fire({
                title: "Error!",
                text: "Keranjang masih kosong!",
                icon: "error",
                timer: 1500,
                showConfirmButton: false,
            });
            return;
        }

        if (discountValue > subtotal) {
            Swal.fire({
                title: "Error!",
                text: "Diskon tidak boleh melebihi subtotal.",
                icon: "error",
                timer: 1500,
                showConfirmButton: false,
            });
            return;
        }

        if (paymentMethod === "cash" && cashValue < grandTotal) {
            Swal.fire({
                title: "Error!",
                text: "Uang pembayaran kurang!",
                icon: "error",
                timer: 1500,
                showConfirmButton: false,
            });
            return;
        }

        Swal.fire({
            title: "Proses Pembayaran?",
            text:
                paymentMethod === "cash"
                    ? "Pastikan uang yang diterima sudah sesuai."
                    : "Pembayaran digital akan diproses melalui Midtrans.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Ya, Bayar!",
        }).then(async (result) => {
            if (!result.isConfirmed) {
                return;
            }

            try {
                const response = await fetch("/account/transactions", {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN":
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute("content") || "",
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        customer_id: customerId,
                        discount: discountValue,
                        cash: paymentMethod === "cash" ? cashValue : 0,
                        payment_method: paymentMethod,
                    }),
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Terjadi kesalahan sistem.",
                    );
                }

                if (data.payment_method === "digital") {
                    if (!data.snap_token) {
                        throw new Error("Snap token tidak tersedia.");
                    }

                    openMidtransPopup(data.snap_token, data.invoice);
                    return;
                }

                router.get(`/account/transactions/${data.invoice}`);
            } catch (error) {
                Swal.fire(
                    "Error!",
                    error.message || "Terjadi kesalahan sistem.",
                    "error",
                );
            }
        });
    };

    return (
        <>
            <Head>
                <title>POS Kasir - ZenPOS</title>
            </Head>

            <LayoutAccount>
                <div className="pos-cashier-page">
                    <div className="pos-cashier-heading">
                        <div>
                            <h4>POS Kasir</h4>
                            <span>{cartQty} item dalam keranjang</span>
                        </div>

                        <Link
                            href="/account/transactions"
                            className="btn btn-outline-secondary btn-sm"
                        >
                            <i className="fa fa-receipt me-2"></i>
                            Riwayat
                        </Link>
                    </div>

                    <div className="row g-3">
                        <div className="col-12 col-xl-8">
                            <section className="pos-sale-panel">
                                <form
                                    className="pos-search-bar"
                                    onSubmit={handleSearch}
                                >
                                    <div className="input-group">
                                        <span className="input-group-text">
                                            <i className="fa fa-search"></i>
                                        </span>

                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Scan barcode atau cari produk"
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            autoFocus
                                        />

                                        <button
                                            className="btn btn-success"
                                            type="submit"
                                        >
                                            Cari
                                        </button>
                                    </div>
                                </form>

                                <div className="pos-category-strip">
                                    <button
                                        type="button"
                                        className={`pos-category-pill ${
                                            String(categoryId) === ""
                                                ? "active"
                                                : ""
                                        }`}
                                        onClick={() => handleCategoryClick("")}
                                    >
                                        Semua
                                    </button>

                                    {categories.map((category) => (
                                        <button
                                            type="button"
                                            key={category.id}
                                            className={`pos-category-pill ${
                                                String(categoryId) ===
                                                String(category.id)
                                                    ? "active"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleCategoryClick(category.id)
                                            }
                                        >
                                            {category.name}
                                        </button>
                                    ))}
                                </div>

                                <div className="pos-product-grid">
                                    {products.data.length > 0 ? (
                                        products.data.map((product) => (
                                            <button
                                                type="button"
                                                className={`pos-product-tile ${
                                                    product.stock < 1
                                                        ? "is-disabled"
                                                        : ""
                                                }`}
                                                key={product.id}
                                                onClick={() =>
                                                    product.stock > 0 &&
                                                    addToCart(product.id)
                                                }
                                                disabled={product.stock < 1}
                                            >
                                                <span className="pos-product-image">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.title}
                                                        />
                                                    ) : (
                                                        <i className="fa fa-box"></i>
                                                    )}

                                                    {product.stock < 1 && (
                                                        <span className="pos-product-empty">
                                                            Habis
                                                        </span>
                                                    )}
                                                </span>

                                                <span className="pos-product-name">
                                                    {product.title}
                                                </span>

                                                <span className="pos-product-meta">
                                                    <span>
                                                        Stok {product.stock}
                                                    </span>
                                                    <strong>
                                                        {formatRupiah(
                                                            product.sell_price,
                                                        )}
                                                    </strong>
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="pos-empty-state">
                                            <i className="fa fa-box-open"></i>
                                            <strong>Produk tidak ditemukan</strong>
                                        </div>
                                    )}
                                </div>

                                {products.links.length > 0 && (
                                    <div className="pos-pagination">
                                        <ul className="pagination pagination-sm mb-0">
                                            {products.links.map(
                                                (link, index) => (
                                                    <li
                                                        key={index}
                                                        className={`page-item ${
                                                            link.active
                                                                ? "active"
                                                                : ""
                                                        } ${
                                                            link.url === null
                                                                ? "disabled"
                                                                : ""
                                                        }`}
                                                    >
                                                        <Link
                                                            className="page-link"
                                                            href={
                                                                link.url || "#"
                                                            }
                                                            dangerouslySetInnerHTML={{
                                                                __html: link.label,
                                                            }}
                                                            preserveState
                                                            preserveScroll
                                                        />
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="col-12 col-xl-4">
                            <section className="pos-checkout-panel">
                                <div className="pos-checkout-header">
                                    <div>
                                        <h5>Keranjang</h5>
                                        <span>{carts.length} baris transaksi</span>
                                    </div>

                                    <span className="pos-cart-count">
                                        {cartQty}
                                    </span>
                                </div>

                                {(errors.error || flash?.error) && (
                                    <div className="alert alert-danger mx-3 mt-3 mb-0">
                                        {errors.error || flash.error}
                                    </div>
                                )}

                                <div className="pos-cart-list">
                                    {carts.length > 0 ? (
                                        carts.map((cart) => (
                                            <div
                                                className="pos-cart-row"
                                                key={cart.id}
                                            >
                                                <div className="pos-cart-main">
                                                    <strong>
                                                        {cart.product.title}
                                                    </strong>
                                                    <span>
                                                        {formatRupiah(
                                                            cart.price,
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="pos-cart-actions">
                                                    <div className="pos-qty-stepper">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateCart(
                                                                    cart.id,
                                                                    cart.qty -
                                                                        1,
                                                                )
                                                            }
                                                        >
                                                            <i className="fa fa-minus"></i>
                                                        </button>

                                                        <span>{cart.qty}</span>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateCart(
                                                                    cart.id,
                                                                    cart.qty +
                                                                        1,
                                                                )
                                                            }
                                                        >
                                                            <i className="fa fa-plus"></i>
                                                        </button>
                                                    </div>

                                                    <strong>
                                                        {formatRupiah(
                                                            cart.price *
                                                                cart.qty,
                                                        )}
                                                    </strong>

                                                    <button
                                                        type="button"
                                                        className="pos-cart-delete"
                                                        onClick={() =>
                                                            deleteCart(cart.id)
                                                        }
                                                    >
                                                        <i className="fa fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="pos-empty-cart">
                                            <i className="fa fa-shopping-basket"></i>
                                            <strong>Keranjang kosong</strong>
                                            <span>
                                                Item belanja akan tampil di
                                                bagian ini.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <form
                                    className="pos-payment-form"
                                    onSubmit={storeTransaction}
                                >
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Metode Pembayaran
                                        </label>

                                        <div className="pos-method-toggle">
                                            <input
                                                type="radio"
                                                className="btn-check"
                                                name="payment_method"
                                                id="payment-cash"
                                                value="cash"
                                                checked={
                                                    paymentMethod === "cash"
                                                }
                                                onChange={(e) =>
                                                    setPaymentMethod(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <label
                                                className="pos-method-option"
                                                htmlFor="payment-cash"
                                            >
                                                Tunai
                                            </label>

                                            <input
                                                type="radio"
                                                className="btn-check"
                                                name="payment_method"
                                                id="payment-digital"
                                                value="digital"
                                                checked={
                                                    paymentMethod === "digital"
                                                }
                                                onChange={(e) => {
                                                    setPaymentMethod(
                                                        e.target.value,
                                                    );
                                                    setCash("");
                                                }}
                                            />
                                            <label
                                                className="pos-method-option"
                                                htmlFor="payment-digital"
                                            >
                                                Digital
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">
                                            Pelanggan
                                        </label>
                                        <select
                                            className="form-select"
                                            value={customerId}
                                            onChange={(e) =>
                                                setCustomerId(e.target.value)
                                            }
                                        >
                                            <option value="">Umum</option>
                                            {customers.map((customer) => (
                                                <option
                                                    value={customer.id}
                                                    key={customer.id}
                                                >
                                                    {customer.name} -{" "}
                                                    {customer.no_telp}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div
                                            className={
                                                paymentMethod === "cash"
                                                    ? "col-5"
                                                    : "col-12"
                                            }
                                        >
                                            <label className="form-label">
                                                Diskon
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={discount}
                                                onChange={(e) =>
                                                    setDiscount(e.target.value)
                                                }
                                                min="0"
                                            />
                                        </div>

                                        {paymentMethod === "cash" && (
                                            <div className="col-7">
                                                <label className="form-label">
                                                    Uang Tunai
                                                </label>
                                                <input
                                                    type="number"
                                                    className="form-control pos-cash-input"
                                                    value={cash}
                                                    onChange={(e) =>
                                                        setCash(e.target.value)
                                                    }
                                                    min="0"
                                                    required
                                                />

                                                {cashOptions.length > 0 && (
                                                    <div className="pos-cash-shortcuts">
                                                        {cashOptions.map(
                                                            (option, index) => (
                                                                <button
                                                                    type="button"
                                                                    key={option}
                                                                    onClick={() =>
                                                                        setCash(
                                                                            String(
                                                                                option,
                                                                            ),
                                                                        )
                                                                    }
                                                                >
                                                                    {index ===
                                                                    0
                                                                        ? "Pas"
                                                                        : formatRupiah(
                                                                              option,
                                                                          )}
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {paymentMethod === "digital" && (
                                        <div className="alert alert-info small">
                                            Pembayaran digital akan diproses
                                            melalui Midtrans. Kasir tidak perlu
                                            mengisi uang tunai.
                                        </div>
                                    )}

                                    <div className="pos-summary-box">
                                        <div>
                                            <span>Subtotal</span>
                                            <strong>
                                                {formatRupiah(subtotal)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Diskon</span>
                                            <strong className="text-danger">
                                                -{formatRupiah(discountValue)}
                                            </strong>
                                        </div>

                                        <div className="pos-summary-total">
                                            <span>Total</span>
                                            <strong>
                                                {formatRupiah(grandTotal)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                {paymentMethod === "cash"
                                                    ? "Kembalian"
                                                    : "Status"}
                                            </span>
                                            <strong className="text-success">
                                                {paymentMethod === "cash"
                                                    ? formatRupiah(change)
                                                    : "Menunggu pembayaran"}
                                            </strong>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-success btn-lg w-100 pos-pay-button"
                                        disabled={carts.length === 0}
                                    >
                                        <i className="fa fa-check-circle me-2"></i>
                                        Proses Pembayaran
                                    </button>
                                </form>
                            </section>
                        </div>
                    </div>
                </div>
            </LayoutAccount>
        </>
    );
}
