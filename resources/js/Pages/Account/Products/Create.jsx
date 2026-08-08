import React, { useState } from "react";
import LayoutAccount from "../../../Layouts/Account";
import { Head, usePage, router, Link } from "@inertiajs/react";
import Swal from "sweetalert2";

export default function ProductCreate() {
    const { errors = {}, categories = [] } = usePage().props;

    const [barcode, setBarcode] = useState("");
    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [image, setImage] = useState("");
    const [description, setDescription] = useState("");
    const [buyPrice, setBuyPrice] = useState("");
    const [sellPrice, setSellPrice] = useState("");
    const [unit, setUnit] = useState("");
    const [stock, setStock] = useState("");
    const isSellPriceBelowBuyPrice =
    Number(sellPrice || 0) < Number(buyPrice || 0);

    const storeProduct = (e) => {
    e.preventDefault();

    if (isSellPriceBelowBuyPrice) {
        Swal.fire({
            title: "Validasi gagal",
            text: "Harga jual tidak boleh lebih rendah dari harga beli.",
            icon: "warning",
        });

        return;
    }

    router.post(
        "/account/products",
        {
            barcode: barcode,
            title: title,
            category_id: categoryId,
            image: image,
            description: description,
            buy_price: buyPrice,
            sell_price: sellPrice,
            unit: unit,
            stock: stock,
        },
        {
            onSuccess: () => {
                Swal.fire({
                    title: "Berhasil!",
                    text: "Data berhasil disimpan!",
                    icon: "success",
                    showConfirmButton: false,
                    timer: 1500,
                });
            },
        },
    );
};

    return (
        <>
            <Head>
                <title>Tambah Produk - ZenPOS</title>
            </Head>

            <LayoutAccount>
                <div className="row mt-4">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm rounded-3">
                            <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold">
                                    <i className="fa fa-box-open me-2"></i>
                                    TAMBAH PRODUK
                                </h5>

                                <div>
                                    <Link
                                        href="/account/products"
                                        className="btn btn-secondary shadow-sm rounded-sm"
                                    >
                                        <i className="fa fa-arrow-left me-2"></i>
                                        KEMBALI
                                    </Link>
                                </div>
                            </div>

                            <div className="card-body">
                                <form onSubmit={storeProduct}>
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Barcode
                                            </label>

                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className={`form-control ${
                                                        errors.barcode
                                                            ? "is-invalid"
                                                            : ""
                                                    }`}
                                                    value={barcode}
                                                    onChange={(e) =>
                                                        setBarcode(
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="Masukkan barcode atau scan"
                                                />

                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={() => {
                                                        const randomBarcode =
                                                            Math.floor(
                                                                1000000000000 +
                                                                    Math.random() *
                                                                        9000000000000
                                                            ).toString();

                                                        setBarcode(
                                                            randomBarcode
                                                        );
                                                    }}
                                                >
                                                    <i className="fa fa-barcode me-1"></i>
                                                    Generate
                                                </button>
                                            </div>

                                            {errors.barcode && (
                                                <div className="text-danger small mt-1">
                                                    {errors.barcode}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Kategori
                                            </label>

                                            <select
                                                className={`form-select ${
                                                    errors.category_id
                                                        ? "is-invalid"
                                                        : ""
                                                }`}
                                                value={categoryId}
                                                onChange={(e) =>
                                                    setCategoryId(
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    -- Pilih Kategori --
                                                </option>

                                                {categories.map((category) => (
                                                    <option
                                                        key={category.id}
                                                        value={category.id}
                                                    >
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>

                                            {errors.category_id && (
                                                <div className="invalid-feedback">
                                                    {errors.category_id}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Nama Produk
                                            </label>

                                            <input
                                                type="text"
                                                className={`form-control ${
                                                    errors.title
                                                        ? "is-invalid"
                                                        : ""
                                                }`}
                                                value={title}
                                                onChange={(e) =>
                                                    setTitle(e.target.value)
                                                }
                                                placeholder="Masukkan nama produk"
                                            />

                                            {errors.title && (
                                                <div className="invalid-feedback">
                                                    {errors.title}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Gambar Produk
                                            </label>

                                            <input
                                                type="file"
                                                className={`form-control ${
                                                    errors.image
                                                        ? "is-invalid"
                                                        : ""
                                                }`}
                                                onChange={(e) =>
                                                    setImage(e.target.files[0])
                                                }
                                                accept="image/*"
                                            />

                                            {errors.image && (
                                                <div className="invalid-feedback">
                                                    {errors.image}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Harga Beli
                                            </label>

                                            <div className="input-group">
                                                <span className="input-group-text">
                                                    Rp
                                                </span>

                                                <input
                                                    type="number"
                                                    className={`form-control ${
                                                        errors.buy_price
                                                            ? "is-invalid"
                                                            : ""
                                                    }`}
                                                    value={buyPrice}
                                                    onChange={(e) =>
                                                        setBuyPrice(
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="0"
                                                />
                                            </div>

                                            {errors.buy_price && (
                                                <div className="text-danger small mt-1">
                                                    {errors.buy_price}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Harga Jual
                                            </label>

                                            <div className="input-group">
                                                <span className="input-group-text">
                                                    Rp
                                                </span>

                                               <input
                                                    type="number"
                                                    min={buyPrice || 0}
                                                    className={`form-control ${
                                                        errors.sell_price || isSellPriceBelowBuyPrice
                                                            ? "is-invalid"
                                                            : ""
                                                    }`}
                                                    value={sellPrice}
                                                    onChange={(e) => setSellPrice(e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>

                                            {errors.sell_price && (
                                                <div className="text-danger small mt-1">
                                                    {errors.sell_price}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Unit (Satuan)
                                            </label>

                                            <input
                                                type="text"
                                                className={`form-control ${
                                                    errors.unit
                                                        ? "is-invalid"
                                                        : ""
                                                }`}
                                                value={unit}
                                                onChange={(e) =>
                                                    setUnit(e.target.value)
                                                }
                                                placeholder="Pcs, Box, Kg, dll"
                                            />

                                            {errors.unit && (
                                                <div className="invalid-feedback">
                                                    {errors.unit}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-6 mb-3">
                                            <label className="fw-bold mb-2">
                                                Stok Awal
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                className={`form-control ${
                                                    errors.stock
                                                        ? "is-invalid"
                                                        : ""
                                                }`}
                                                value={stock}
                                                onChange={(e) =>
                                                    setStock(e.target.value)
                                                }
                                                placeholder="0"
                                            />

                                            <small className="d-block mt-1">
                                                Stok awal akan otomatis tercatat
                                                ke histori mutasi stok.
                                            </small>

                                            {errors.stock && (
                                                <div className="invalid-feedback">
                                                    {errors.stock}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="fw-bold mb-2">
                                            Deskripsi{" "}
                                            <span className="text-muted fw-normal">
                                                (Opsional)
                                            </span>
                                        </label>

                                        <textarea
                                            className={`form-control ${
                                                errors.description
                                                    ? "is-invalid"
                                                    : ""
                                            }`}
                                            value={description}
                                            onChange={(e) =>
                                                setDescription(e.target.value)
                                            }
                                            rows="3"
                                            placeholder="Masukkan deskripsi produk"
                                        ></textarea>

                                        {errors.description && (
                                            <div className="invalid-feedback">
                                                {errors.description}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <button
                                            type="submit"
                                            className="btn btn-success shadow-sm rounded-sm"
                                        >
                                            <i className="fa fa-save me-2"></i>
                                            SIMPAN
                                        </button>

                                        <button
                                            type="reset"
                                            className="btn btn-warning shadow-sm rounded-sm ms-2 text-white"
                                        >
                                            <i className="fa fa-redo me-2"></i>
                                            ULANGI
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </LayoutAccount>
        </>
    );
}
