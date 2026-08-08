import React, { useMemo, useState } from "react";
import LayoutAccount from "../../../Layouts/Account";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { formatRupiah } from "../../../Utils/format";

const reasonOptions = [
    { value: "defect", label: "Barang Rusak" },
    { value: "expired", label: "Kedaluwarsa" },
    { value: "wrong_item", label: "Barang Tidak Sesuai" },
    { value: "other", label: "Lainnya" },
];

export default function SupplierReturnCreate() {
    const {
        purchase,
        returnableItems = [],
        defaultReturnDate,
        errors = {},
    } = usePage().props;

    const [returnDate, setReturnDate] = useState(defaultReturnDate);
    const [reason, setReason] = useState("defect");
    const [note, setNote] = useState("");
    const [items, setItems] = useState(
        returnableItems.map((item) => ({
            purchase_detail_id: item.purchase_detail_id,
            qty: 0,
        })),
    );

    const returnableMap = useMemo(() => {
        return returnableItems.reduce((acc, item) => {
            acc[item.purchase_detail_id] = item;
            return acc;
        }, {});
    }, [returnableItems]);

    const handleQtyChange = (purchaseDetailId, value) => {
        const maxQty = returnableMap[purchaseDetailId]?.max_return_qty || 0;
        const normalizedValue = Math.max(
            0,
            Math.min(Number(value || 0), maxQty),
        );

        setItems((prevItems) =>
            prevItems.map((item) =>
                item.purchase_detail_id === purchaseDetailId
                    ? { ...item, qty: normalizedValue }
                    : item,
            ),
        );
    };

    const selectedItems = items.filter((item) => Number(item.qty || 0) > 0);

    const totalQty = selectedItems.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0,
    );

    const totalAmount = selectedItems.reduce((sum, item) => {
        const detail = returnableMap[item.purchase_detail_id];

        return sum + Number(item.qty || 0) * Number(detail?.buy_price || 0);
    }, 0);

    const storeSupplierReturn = (e) => {
        e.preventDefault();

        router.post("/account/supplier-returns", {
            purchase_id: purchase.id,
            return_date: returnDate,
            reason,
            note,
            items: items.map((item) => ({
                purchase_detail_id: item.purchase_detail_id,
                qty: Number(item.qty || 0),
            })),
        });
    };

    return (
        <>
            <Head>
                <title>{`Retur Supplier ${purchase.invoice} - ZenPOS`}</title>
            </Head>

            <LayoutAccount>
                <div className="row mt-4">
                    <div className="col-12 mb-4">
                        <div className="card border-0 shadow-sm rounded-3">
                            <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold">
                                    <i className="fa fa-undo me-2"></i>
                                    BUAT RETUR SUPPLIER
                                </h5>

                                <div className="d-flex gap-2">
                                    <Link
                                        href={`/account/purchases/${purchase.invoice}`}
                                        className="btn btn-secondary shadow-sm rounded-sm"
                                    >
                                        <i className="fa fa-arrow-left me-2"></i>
                                        KEMBALI
                                    </Link>

                                    <Link
                                        href="/account/supplier-returns"
                                        className="btn btn-outline-secondary shadow-sm rounded-sm"
                                    >
                                        <i className="fa fa-list me-2"></i>
                                        RIWAYAT
                                    </Link>
                                </div>
                            </div>

                            <div className="card-body">
                                {errors.items && (
                                    <div className="alert alert-danger shadow-sm">
                                        {errors.items}
                                    </div>
                                )}

                                <div className="row g-4 mb-4">
                                    <div className="col-lg-4">
                                        <div className="border rounded-3 p-3 h-100">
                                            <div className="small text-muted mb-1">
                                                Invoice Pembelian
                                            </div>

                                            <div className="fw-bold text-primary mb-3">
                                                {purchase.invoice}
                                            </div>

                                            <div className="small text-muted mb-1">
                                                Supplier
                                            </div>

                                            <div className="fw-bold">
                                                {purchase.supplier?.name || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-4">
                                        <div className="border rounded-3 p-3 h-100">
                                            <div className="small text-muted mb-1">
                                                Tanggal Pembelian
                                            </div>

                                            <div className="fw-bold mb-3">
                                                {new Date(
                                                    purchase.purchase_date,
                                                ).toLocaleDateString("id-ID")}
                                            </div>

                                            <div className="small text-muted mb-1">
                                                Dibuat Oleh
                                            </div>

                                            <div className="fw-bold">
                                                {purchase.user?.name || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-4">
                                        <div className="border rounded-3 p-3 h-100 bg-light">
                                            <div className="small text-muted mb-1">
                                                Ringkasan Retur
                                            </div>

                                            <div className="fw-bold mb-2">
                                                Total Qty: {totalQty}
                                            </div>

                                            <div className="fw-bold text-danger">
                                                {formatRupiah(totalAmount)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={storeSupplierReturn}>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <label className="fw-bold mb-2">
                                                Tanggal Retur
                                            </label>

                                            <input
                                                type="date"
                                                className={`form-control ${errors.return_date ? "is-invalid" : ""}`}
                                                value={returnDate}
                                                onChange={(e) =>
                                                    setReturnDate(
                                                        e.target.value,
                                                    )
                                                }
                                            />

                                            {errors.return_date && (
                                                <div className="invalid-feedback">
                                                    {errors.return_date}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-4">
                                            <label className="fw-bold mb-2">
                                                Alasan
                                            </label>

                                            <select
                                                className={`form-select ${errors.reason ? "is-invalid" : ""}`}
                                                value={reason}
                                                onChange={(e) =>
                                                    setReason(e.target.value)
                                                }
                                            >
                                                {reasonOptions.map((option) => (
                                                    <option
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>

                                            {errors.reason && (
                                                <div className="invalid-feedback">
                                                    {errors.reason}
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-4">
                                            <label className="fw-bold mb-2">
                                                Catatan
                                            </label>

                                            <textarea
                                                rows="1"
                                                className={`form-control ${errors.note ? "is-invalid" : ""}`}
                                                value={note}
                                                onChange={(e) =>
                                                    setNote(e.target.value)
                                                }
                                                placeholder="Catatan retur supplier"
                                            />

                                            {errors.note && (
                                                <div className="invalid-feedback">
                                                    {errors.note}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="table-responsive mb-4">
                                        <table className="table table-bordered align-middle mb-0">
                                            <thead className="table-dark">
                                                <tr>
                                                    <th>Produk</th>
                                                    <th className="text-center">
                                                        Qty Beli
                                                    </th>
                                                    <th className="text-center">
                                                        Sudah Retur
                                                    </th>
                                                    <th className="text-center">
                                                        Sisa Boleh Retur
                                                    </th>
                                                    <th className="text-center">
                                                        Stok Saat Ini
                                                    </th>
                                                    <th className="text-center">
                                                        Maksimal Retur
                                                    </th>
                                                    <th className="text-center">
                                                        Qty Retur
                                                    </th>
                                                    <th className="text-end">
                                                        Harga Beli
                                                    </th>
                                                    <th className="text-end">
                                                        Subtotal
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {returnableItems.map(
                                                    (item, index) => {
                                                        const formItem =
                                                            items.find(
                                                                (entry) =>
                                                                    entry.purchase_detail_id ===
                                                                    item.purchase_detail_id,
                                                            );

                                                        const qty = Number(
                                                            formItem?.qty || 0,
                                                        );

                                                        const subtotal =
                                                            qty *
                                                            Number(
                                                                item.buy_price ||
                                                                    0,
                                                            );

                                                        return (
                                                            <tr
                                                                key={
                                                                    item.purchase_detail_id
                                                                }
                                                            >
                                                                <td>
                                                                    <div className="fw-bold">
                                                                        {
                                                                            item.product_title
                                                                        }
                                                                    </div>

                                                                    <div className="small text-muted">
                                                                        {item.product_barcode ||
                                                                            "-"}
                                                                        {item.unit
                                                                            ? ` | ${item.unit}`
                                                                            : ""}
                                                                    </div>
                                                                </td>

                                                                <td className="text-center fw-bold">
                                                                    {
                                                                        item.purchased_qty
                                                                    }
                                                                </td>

                                                                <td className="text-center">
                                                                    {
                                                                        item.returned_qty
                                                                    }
                                                                </td>

                                                                <td className="text-center">
                                                                    {
                                                                        item.remaining_qty
                                                                    }
                                                                </td>

                                                                <td className="text-center">
                                                                    {
                                                                        item.current_stock
                                                                    }
                                                                </td>

                                                                <td className="text-center fw-bold text-primary">
                                                                    {
                                                                        item.max_return_qty
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={
                                                                            item.max_return_qty
                                                                        }
                                                                        className={`form-control text-center ${errors[`items.${index}.qty`] ? "is-invalid" : ""}`}
                                                                        value={
                                                                            qty
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleQtyChange(
                                                                                item.purchase_detail_id,
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            item.max_return_qty ===
                                                                            0
                                                                        }
                                                                    />

                                                                    {errors[
                                                                        `items.${index}.qty`
                                                                    ] && (
                                                                        <div className="invalid-feedback">
                                                                            {
                                                                                errors[
                                                                                    `items.${index}.qty`
                                                                                ]
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </td>

                                                                <td className="text-end">
                                                                    {formatRupiah(
                                                                        item.buy_price,
                                                                    )}
                                                                </td>

                                                                <td className="text-end fw-bold text-danger">
                                                                    {formatRupiah(
                                                                        subtotal,
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    },
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-danger shadow-sm rounded-sm"
                                    >
                                        <i className="fa fa-save me-2"></i>
                                        SIMPAN RETUR SUPPLIER
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </LayoutAccount>
        </>
    );
}
