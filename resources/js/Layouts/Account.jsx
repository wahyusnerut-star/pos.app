import React, { useEffect, useState } from "react";
import { NavDropdown } from "react-bootstrap";
import { usePage, router } from "@inertiajs/react";
import Sidebar from "../Components/Sidebar";

export default function LayoutAccount({ children }) {
    const { url, props } = usePage();
    const { auth, store } = props;

    const [sidebarToggle, setSidebarToggle] = useState(false);
    const isPosCashierPage = url.startsWith("/account/transactions/create");

    const storeName = store?.name || "ZEN POS";
    const storeLogo = store?.logo_url;

    const userName = auth?.user?.name || "User";

    const sidebarToggleHandler = (e) => {
        e.preventDefault();

        setSidebarToggle((current) => !current);
    };

    useEffect(() => {
        document.body.classList.toggle(
            "sb-sidenav-toggled",
            sidebarToggle && !isPosCashierPage,
        );

        return () => {
            document.body.classList.remove("sb-sidenav-toggled");
        };
    }, [sidebarToggle, isPosCashierPage]);

    useEffect(() => {
        setSidebarToggle(false);
    }, [url]);

    const logoutHandler = (e) => {
        e.preventDefault();

        router.post("/logout");
    };

    return (
        <>
            <div
                className={`d-flex ${
                    isPosCashierPage
                        ? sidebarToggle
                            ? "pos-sidebar-visible"
                            : "pos-sidebar-hidden"
                        : ""
                }`}
                id="wrapper"
            >
                <div className="bg-sidebar" id="sidebar-wrapper">
                    <div className="sidebar-heading bg-light">
                        <div className="sidebar-store-brand">
                            {storeLogo ? (
                                <img
                                    src={storeLogo}
                                    className="sidebar-store-logo"
                                    alt={storeName}
                                />
                            ) : (
                                <span className="sidebar-store-logo-placeholder">
                                    <i className="fa fa-store"></i>
                                </span>
                            )}

                            <strong className="sidebar-store-name">
                                {storeName}
                            </strong>
                        </div>
                    </div>

                    <Sidebar />
                </div>

                <div id="page-content-wrapper">
                    <nav className="navbar navbar-expand-lg navbar-light bg-light">
                        <div className="container-fluid">
                            <button
                                className="btn btn-success-dark"
                                onClick={sidebarToggleHandler}
                            >
                                <i className="fa fa-list-ul"></i>
                            </button>

                            <ul className="navbar-nav ms-auto mb-0">
                                <NavDropdown
                                    align="end"
                                    title={userName}
                                    className="fw-bold"
                                    id="user-nav-dropdown"
                                >
                                    <NavDropdown.Item onClick={logoutHandler}>
                                        <i className="fa fa-sign-out-alt me-2"></i>
                                        Keluar
                                    </NavDropdown.Item>
                                </NavDropdown>
                            </ul>
                        </div>
                    </nav>

                    <div className="container-fluid">{children}</div>
                </div>
            </div>
        </>
    );
}
