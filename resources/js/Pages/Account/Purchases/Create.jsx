import React from "react";
import LayoutAccount from "../../../Layouts/Account";
import { Head, useForm, usePage } from "@inertiajs/react";

export default function PurchaseCreate({ suppliers, products, auth }) {
    // 1. Ambil URL halaman aktif saat ini secara otomatis dari Inertia props
    const { url } = usePage();

    // 2. Inisialisasi State Form Menggunakan useForm Inertia
    const { data, setData, post, errors, processing } = useForm({
        supplier_id: "",
        purchase_date: new Date().toISOString().split("T")[0],
        note: "",
        items: [{ product_id: "", qty: 1, buy_price: "" }],
    });

    // 3. Mapping Master Produk untuk Mempermudah Pencarian Harga Jual secara Real-time
    const productMap = products.reduce((map, product) => {
        map[product.id] = product;
        return map;
    }, {});

    // 4. Fungsi Menambah Baris Produk Baru di Tabel
    const addItem = () => {
        setData("items", [...data.items, { product_id: "", qty: 1, buy_price: "" }]);
    };

    // 5. Fungsi Menghapus Baris Produk dari Tabel
    const removeItem = (index) => {
        if (data.items.length > 1) {
            const newItems = data.items.filter((_, i) => i !== index);
            setData("items", newItems);
        }
    };

    // 6. Fungsi Mengelola Perubahan Input dalam Tabel Dinamis
    const handleItemChange = (index, field, value) => {
        const newItems = [...data.items];
        newItems[index][field] = value;
        setData("items", newItems);
    };

    // 7. Kalkulasi Otomatis untuk Total Qty dan Total Nilai Pembelian
    const totalQty = data.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalAmount = data.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.buy_price || 0)), 0);

    // 8. Fungsi Kirim Form Mendeteksi URL Otomatis (Anti Error 404)
    const storePurchase = (e) => {
        e.preventDefault();

        // Memotong ujung URL '/create' agar menembak rute POST utama dengan tepat
        const targetUrl = url.replace('/create', '');

        post(targetUrl, {
            onSuccess: () => {
                alert("Transaksi berhasil disimpan!");
            },
            onError: (err) => {
                console.log("Detail Error Server:", err);
                alert("Gagal menyimpan transaksi! Periksa kembali kelengkapan input data Anda.");
            }
        });
    };

    return (
        <LayoutAccount auth={auth}>
            <Head>
                <title>Tambah Data - ZenPOS</title>
            </Head>

            <div className="container-fluid mb-5 mt-5">
                <div className="row">
                    <div className="col-md-12">
                        <div className="card border-0 shadow-sm rounded-3">
                            <div className="card-header bg-transparent border-0 mt-3">
                                <h5 className="fw-bold">
                                    <i className="fa fa-shopping-cart me-2"></i> TAMBAH TRANSAKSI
                                </h5>
                            </div>
                            <div className="card-body">
                                <form onSubmit={storePurchase}>

                                    {/* AREA INPUT UTAMA (SUPPLIER & TANGGAL) */}
                                    <div className="row mb-4">
                                        <div className="col-md-6 mb-3">
                                            <label className="form-label fw-bold">Supplier</label>
                                            <select
                                                className={`form-select ${errors.supplier_id ? "is-invalid" : ""}`}
                                                value={data.supplier_id}
                                                onChange={(e) => setData("supplier_id", e.target.value)}
                                            >
                                                <option value="">--- Pilih Supplier ---</option>
                                                {suppliers.map((supplier) => (
                                                    <option key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.supplier_id && <div className="invalid-feedback">{errors.supplier_id}</div>}
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <label className="form-label fw-bold">Tanggal Transaksi</label>
                                            <input
                                                type="date"
                                                className={`form-control ${errors.purchase_date ? "is-invalid" : ""}`}
                                                value={data.purchase_date}
                                                onChange={(e) => setData("purchase_date", e.target.value)}
                                            />
                                            {errors.purchase_date && <div className="invalid-feedback">{errors.purchase_date}</div>}
                                        </div>
                                    </div>

                                    {/* AREA TABEL DINAMIS PRODUK */}
                                    <div className="table-responsive mb-3">
                                        <table className="table table-bordered table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th style={{ width: "35%" }}>Nama Produk</th>
                                                    <th style={{ width: "15%" }} className="text-end">Qty</th>
                                                    <th style={{ width: "20%" }} className="text-end">Harga Beli</th>
                                                    <th style={{ width: "20%" }} className="text-end">Subtotal</th>
                                                    <th style={{ width: "10%" }} className="text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.items.map((item, index) => {
                                                    const selectedProduct = productMap[item.product_id];
                                                    const subtotal = Number(item.qty || 0) * Number(item.buy_price || 0);

                                                    // Validasi Langkah 9: Memeriksa perbandingan harga beli vs harga jual master produk
                                                    const buyPriceAboveSellPrice = selectedProduct && item.buy_price && selectedProduct.sell_price
                                                        ? Number(item.buy_price) > Number(selectedProduct.sell_price)
                                                        : false;

                                                    return (
                                                        <tr key={index}>
                                                            {/* PILIHAN PRODUK */}
                                                            <td>
                                                                <select
                                                                    className={`form-select ${errors[`items.${index}.product_id`] ? "is-invalid" : ""}`}
                                                                    value={item.product_id}
                                                                    onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
                                                                >
                                                                    <option value="">--- Pilih Produk ---</option>
                                                                    {products.map((p) => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.title} (Jual: Rp {Number(p.sell_price).toLocaleString()})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* INPUT QUANTITY */}
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className="form-control text-end"
                                                                    value={item.qty}
                                                                    onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                                                                />
                                                            </td>

                                                            {/* INPUT HARGA BELI & VALIDASI LANGKAH 9 */}
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    className={`form-control text-end ${
                                                                        errors[`items.${index}.buy_price`] || buyPriceAboveSellPrice ? "is-invalid" : ""
                                                                    }`}
                                                                    value={item.buy_price}
                                                                    onChange={(e) => handleItemChange(index, "buy_price", e.target.value)}
                                                                />

                                                                {errors[`items.${index}.buy_price`] && (
                                                                    <div className="text-danger small mt-1">{errors[`items.${index}.buy_price`]}</div>
                                                                )}

                                                                {!errors[`items.${index}.buy_price`] && buyPriceAboveSellPrice && (
                                                                    <div className="text-danger small mt-1">Harga beli tidak boleh lebih tinggi dari harga jual.</div>
                                                                )}
                                                            </td>

                                                            {/* SUBTOTAL BARIS */}
                                                            <td className="text-end align-middle">
                                                                Rp {subtotal.toLocaleString()}
                                                            </td>

                                                            {/* TOMBOL HAPUS BARIS */}
                                                            <td className="text-center align-middle">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => removeItem(index)}
                                                                    disabled={data.items.length === 1}
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>

                                            {/* FOOTER TABEL */}
                                            <tfoot className="table-light fw-bold">
                                                <tr>
                                                    <td>TOTAL</td>
                                                    <td className="text-end">{totalQty.toLocaleString()}</td>
                                                    <td></td>
                                                    <td className="text-end">Rp {totalAmount.toLocaleString()}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* BUTTON TAMBAH BARIS */}
                                    <div className="mb-4">
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                                            <i className="fa fa-plus me-1"></i> Tambah Baris Produk
                                        </button>
                                    </div>

                                    {/* INPUT CATATAN */}
                                    <div className="mb-3">
                                        <label className="form-label fw-bold">Catatan (Opsional)</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="Masukkan catatan tambahan di sini..."
                                            value={data.note}
                                            onChange={(e) => setData("note", e.target.value)}
                                        ></textarea>
                                    </div>

                                    <hr />

                                    {/* ACTION BUTTON SUBMIT */}
                                    <div className="d-flex gap-2 justify-content-end">
                                        <button type="submit" className="btn btn-primary" disabled={processing}>
                                            <i className="fa fa-save me-1"></i> Simpan Transaksi
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </LayoutAccount>
    );
}
