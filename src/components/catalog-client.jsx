"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { calculateItemsSubtotal } from "@/lib/shipping";
import { storeBranches, storeSettings } from "@/lib/store-config";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function getMeasureMeta(rawMeasure) {
  if (!rawMeasure) return null;
  const medida = rawMeasure.trim();
  if (!medida) return null;
  if (/rodado/i.test(medida)) return { label: "Rodado", value: medida };
  if (/plaza/i.test(medida)) return { label: "Plazas", value: medida };
  if (/kg/i.test(medida)) return { label: "Capacidad", value: medida };
  return { label: "Medida", value: medida };
}

function supportsAccessory(product) {
  const name = `${product.nombre} ${product.categoria || ""}`.toLowerCase();
  return /(placard|placares|placar|cajonera|comodon|comoda|ropero|biblioteca|modular|despensero|alacena|mesa de luz|vanitory)/i.test(
    name,
  );
}

function useRevealOnScroll(activeView) {
  useEffect(() => {
    if (activeView !== "inicio") return undefined;
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!elements.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("revealed");
        });
      },
      { threshold: 0.16 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeView]);
}

function ProductPlaceholder({ title, compact = false }) {
  return (
    <div className={compact ? "product-visual compact" : "product-visual"}>
      <div className="visual-topline">
        <div className="visual-badge">Manarey</div>
        <div className="visual-dot" />
      </div>
      <div className="visual-body">
        {title ? <div className="visual-title">{title}</div> : null}
      </div>
    </div>
  );
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}


export function CatalogClient({ initialProducts, session, catalogError }) {
  const whatsappNumber = storeSettings.whatsappNumber;
  const contactEmail = storeSettings.supportEmail;
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [sortBy, setSortBy] = useState("relevancia");
  // Admin login (para gestionar productos)
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Customer auth modal
  const [customerAuthOpen, setCustomerAuthOpen] = useState(false);
  const [customerAuthMode, setCustomerAuthMode] = useState("login"); // login | register
  const [customerAuthData, setCustomerAuthData] = useState({ email: "", password: "", nombre: "", apellido: "", telefono: "" });
  const [customerAuthBusy, setCustomerAuthBusy] = useState(false);
  const [customerAuthError, setCustomerAuthError] = useState("");
  const [catalogCustomer, setCatalogCustomer] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null);
  const [adminEditorOpen, setAdminEditorOpen] = useState(false); // modal del editor admin
  const [adminPhotoFilter, setAdminPhotoFilter] = useState("todos"); // "todos" | "sin-foto" | "con-foto"
  const [adminBranchFilter, setAdminBranchFilter] = useState(""); // "" | branch name
  const [shippingSettingsOpen, setShippingSettingsOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState({ baseCost: "", perKm: "" });
  const [shippingFormBusy, setShippingFormBusy] = useState(false);
  const [shippingFormMsg, setShippingFormMsg] = useState("");
  const [branchStockCache, setBranchStockCache] = useState({}); // { [productKey]: [{ local, stock }] }
  const [stockUpdating, setStockUpdating] = useState({}); // { [productKey+local]: true }
  const [selectedVariants, setSelectedVariants] = useState({}); // { [variantGroupKey]: productKey }
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeView, setActiveView] = useState("inicio");
  const [homeCategory, setHomeCategory] = useState("");
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [detailAccessorySelected, setDetailAccessorySelected] = useState(false);
  const [pending, startTransition] = useTransition();

  useRevealOnScroll(activeView);

  const accessoryProduct = useMemo(
    () =>
      products.find(
        (item) =>
          item.categoria?.toLowerCase() === "accesorios" &&
          item.nombre.toLowerCase().includes("manija"),
      ) || null,
    [products],
  );

  const visibleProducts = useMemo(
    () => {
      const base = products.filter((item) => item.categoria?.toLowerCase() !== "accesorios");
      if (session.isAdmin) return base;
      return base.filter((item) => Boolean(item.imageData));
    },
    [products, session.isAdmin],
  );

  const categories = useMemo(
    () => ["todas", ...new Set(visibleProducts.map((item) => item.categoria).filter(Boolean))],
    [visibleProducts],
  );

  const inStockCount = useMemo(
    () => visibleProducts.filter((product) => !product.isSoldOut).length,
    [visibleProducts],
  );

  useEffect(() => {
    if (!homeCategory) {
      setHomeCategory(categories.find((item) => item !== "todas") || "todas");
    }
  }, [categories, homeCategory]);

  useEffect(() => {
    try {
      const storedCart = window.localStorage.getItem("manarey-cart");
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      const storedCheckout = window.localStorage.getItem("manarey-checkout");
      if (storedCheckout) {
        setCustomerData((current) => ({ ...current, ...JSON.parse(storedCheckout) }));
      }
    } catch {
      window.localStorage.removeItem("manarey-cart");
      window.localStorage.removeItem("manarey-checkout");
    }
  }, []);

  // Cargar sesión del cliente al montar
  useEffect(() => {
    fetch("/api/auth/customer/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.customer) setCatalogCustomer(data.customer); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.localStorage.setItem("manarey-cart", JSON.stringify(cart));
  }, [cart]);

  // Auto-cargar stock de sucursal cuando el admin elige un local
  useEffect(() => {
    if (!session.isAdmin || !adminBranchFilter) return;
    // Carga en paralelo el stock de todos los productos visibles que aún no están en caché
    const toLoad = visibleProducts.filter((p) => !branchStockCache[p.productKey]);
    if (!toLoad.length) return;
    toLoad.forEach((p) => {
      fetch(`/api/products/branch-stock?productKey=${p.productKey}&allBranches=true`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.branches) {
            setBranchStockCache((prev) => ({ ...prev, [p.productKey]: data.branches }));
          }
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminBranchFilter, session.isAdmin]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = visibleProducts.filter((product) => {
      const matchesCategory = category === "todas" || product.categoria?.toLowerCase() === category.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        product.nombre.toLowerCase().includes(normalizedQuery) ||
        (product.categoria || "").toLowerCase().includes(normalizedQuery) ||
        (product.medida || "").toLowerCase().includes(normalizedQuery) ||
        (product.description || "").toLowerCase().includes(normalizedQuery);
      const matchesPhotoFilter =
        !session.isAdmin ||
        adminPhotoFilter === "todos" ||
        (adminPhotoFilter === "sin-foto" && !product.imageData) ||
        (adminPhotoFilter === "con-foto" && Boolean(product.imageData));
      return matchesCategory && matchesQuery && matchesPhotoFilter;
    });
    return [...filtered].sort((left, right) => {
      switch (sortBy) {
        case "precio-asc": return left.precioVenta - right.precioVenta;
        case "precio-desc": return right.precioVenta - left.precioVenta;
        case "nombre": return left.nombre.localeCompare(right.nombre, "es");
        case "stock": return right.stockTotal - left.stockTotal;
        default:
          if (left.isSoldOut !== right.isSoldOut) return left.isSoldOut ? 1 : -1;
          return left.nombre.localeCompare(right.nombre, "es");
      }
    });
  }, [category, query, sortBy, visibleProducts, session.isAdmin, adminPhotoFilter]);

  const filteredGroups = useMemo(() => {
    const groupMap = new Map();
    for (const product of filteredProducts) {
      const key = product.variantGroupKey;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(product);
    }
    const groups = [...groupMap.entries()].map(([key, variants]) => ({ key, variants }));

    // Si hay filtro de sucursal activo y el caché ya cargó, ordenar: primero los que tienen stock > 0 en ese local
    if (adminBranchFilter && Object.keys(branchStockCache).length > 0) {
      groups.sort((a, b) => {
        const stockA = branchStockCache[a.variants[0]?.productKey]?.find((br) => br.local === adminBranchFilter)?.stock ?? -1;
        const stockB = branchStockCache[b.variants[0]?.productKey]?.find((br) => br.local === adminBranchFilter)?.stock ?? -1;
        // Primero los que tienen stock (desc), luego los sin stock, luego los no cargados aún
        if (stockA > 0 && stockB <= 0) return -1;
        if (stockB > 0 && stockA <= 0) return 1;
        if (stockA > 0 && stockB > 0) return stockB - stockA; // mayor stock primero
        return 0;
      });
    }

    return groups;
  }, [filteredProducts, adminBranchFilter, branchStockCache]);

  const homeProducts = useMemo(() => {
    const selectedCategory = homeCategory || categories.find((item) => item !== "todas") || "todas";
    return visibleProducts
      .filter((product) =>
        selectedCategory === "todas"
          ? true
          : product.categoria?.toLowerCase() === selectedCategory.toLowerCase(),
      )
      .slice(0, 5);
  }, [categories, homeCategory, visibleProducts]);

  const featuredMainProduct = homeProducts[0] || null;
  const featuredSideProducts = homeProducts.slice(1, 5);
  const heroCategories = categories.filter((item) => item !== "todas").slice(0, 4);

  const selectedProduct = useMemo(
    () => visibleProducts.find((product) => product.productKey === selectedProductKey) || null,
    [selectedProductKey, visibleProducts],
  );

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return visibleProducts
      .filter(
        (product) =>
          product.productKey !== selectedProduct.productKey &&
          product.categoria === selectedProduct.categoria,
      )
      .slice(0, 4);
  }, [selectedProduct, visibleProducts]);

  const detailAccessoryPrice =
    detailAccessorySelected && accessoryProduct ? accessoryProduct.precioVenta : 0;
  const detailTotal = selectedProduct ? selectedProduct.precioVenta + detailAccessoryPrice : 0;

  const cartCount = useMemo(
    () => cart.reduce((accumulator, item) => accumulator + item.quantity, 0),
    [cart],
  );

  const checkoutSummary = useMemo(
    () => ({ subtotal: calculateItemsSubtotal(cart) }),
    [cart],
  );

  function buildContactLink(message, subject = "Consulta Manarey") {
    if (whatsappNumber) {
      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    }

    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }

  function buildWhatsAppLink(product, withAccessory = false) {
    const parts = [
      `Hola, quiero consultar por ${product.nombre}`,
      product.categoria ? `Categoria: ${product.categoria}` : "",
      product.medida ? `Medida: ${product.medida}` : "",
      `Precio web: ${currencyFormatter.format(
        product.precioVenta + (withAccessory && accessoryProduct ? accessoryProduct.precioVenta : 0),
      )}`,
      withAccessory && accessoryProduct ? `Con ${accessoryProduct.nombre}` : "",
    ].filter(Boolean);

    return buildContactLink(parts.join("\n"), `Consulta por ${product.nombre}`);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    // Intentar login de admin primero
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    // Si falla y parece un email, intentar login de cliente
    if (loginData.username.includes("@")) {
      const custRes = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginData.username, password: loginData.password }),
      });
      if (custRes.ok) {
        const data = await custRes.json();
        setCatalogCustomer(data.customer);
        setLoginOpen(false);
        setLoginData({ username: "", password: "" });
        return;
      }
    }
    const payload = await response.json().catch(() => ({}));
    setLoginError(payload.error || "Usuario o contraseña incorrectos.");
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  // ── Customer auth ────────────────────────────────────────────────────────

  async function handleCustomerAuth(e) {
    e.preventDefault();
    setCustomerAuthBusy(true);
    setCustomerAuthError("");
    try {
      const endpoint = customerAuthMode === "register"
        ? "/api/auth/customer/register"
        : "/api/auth/customer/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerAuthData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de autenticación.");
      setCatalogCustomer(data.customer);
      setLoginOpen(false);
      setCustomerAuthData({ email: "", password: "", nombre: "", apellido: "", telefono: "" });
    } catch (err) {
      setCustomerAuthError(err.message);
    } finally {
      setCustomerAuthBusy(false);
    }
  }

  async function handleCustomerLogout() {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setCatalogCustomer(null);
  }

  function navigateTo(view) {
    setActiveView(view);
    setSelectedProductKey("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProductDetail(product) {
    setSelectedProductKey(product.productKey);
    setDetailAccessorySelected(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getActiveVariant(variantGroupKey, variants) {
    const key = selectedVariants[variantGroupKey];
    return (key && variants.find((v) => v.productKey === key)) || variants[0];
  }

  async function loadBranchStock(productKey) {
    if (branchStockCache[productKey]) return;
    try {
      const res = await fetch(`/api/products/branch-stock?productKey=${productKey}&allBranches=true`);
      if (!res.ok) return;
      const data = await res.json();
      setBranchStockCache((prev) => ({ ...prev, [productKey]: data.branches || [] }));
    } catch {}
  }

  async function updateBranchStock(productKey, local, delta) {
    const cacheKey = `${productKey}::${local}`;
    setStockUpdating((prev) => ({ ...prev, [cacheKey]: true }));
    try {
      const res = await fetch(`/api/products/${productKey}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local, delta }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setBranchStockCache((prev) => ({
        ...prev,
        [productKey]: (prev[productKey] || []).map((b) =>
          b.local === local ? { ...b, stock: data.stock } : b,
        ),
      }));
      // Also update global stockTotal in products list
      setProducts((prev) =>
        prev.map((p) => {
          if (p.productKey !== productKey) return p;
          const newTotal = p.stockTotal + delta;
          return { ...p, stockTotal: Math.max(0, newTotal), isSoldOut: newTotal <= 0 };
        }),
      );
    } finally {
      setStockUpdating((prev) => {
        const n = { ...prev };
        delete n[cacheKey];
        return n;
      });
    }
  }

  function addToCart(product, options = {}) {
    if (product.isSoldOut) return;
    const accessorySelected = Boolean(options.accessorySelected);
    const accessoryPrice = accessorySelected && accessoryProduct ? accessoryProduct.precioVenta : 0;
    const lineKey = accessorySelected ? `${product.productKey}:accessory` : product.productKey;
    setCart((current) => {
      const existing = current.find((item) => item.lineKey === lineKey);
      if (existing) {
        return current.map((item) =>
          item.lineKey === lineKey ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        {
          lineKey,
          productKey: product.productKey,
          nombre: product.nombre,
          precioVenta: product.precioVenta,
          accessoryPrice,
          accessoryLabel: accessorySelected ? accessoryProduct?.nombre || "Manijas" : "",
          quantity: 1,
        },
      ];
    });
    setCartOpen(true);
  }

  function changeCartQuantity(lineKey, delta) {
    setCart((current) =>
      current
        .map((item) => (item.lineKey === lineKey ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function handleEditorChange(productKey, field, value) {
    setActiveEditor((current) => ({
      ...(current && current.productKey === productKey ? current : { productKey }),
      [field]: value,
    }));
  }

  function openEditor(product) {
    setActiveEditor({
      productKey: product.productKey,
      description: product.description || "",
      precioVenta: String(product.precioVenta || ""),
      precioOriginal: product.precioOriginal || product.precioVenta,
      altoCm: product.altoCm != null ? String(product.altoCm) : "",
      anchoCm: product.anchoCm != null ? String(product.anchoCm) : "",
      profundidadCm: product.profundidadCm != null ? String(product.profundidadCm) : "",
      largoCm: product.largoCm != null ? String(product.largoCm) : "",
      litros: product.litros != null ? String(product.litros) : "",
      watts: product.watts != null ? String(product.watts) : "",
      pesoKg: product.pesoKg != null ? String(product.pesoKg) : "",
      voltaje: product.voltaje || "",
      material: product.material || "",
      capacidad: product.capacidad || "",
      imageData: product.imageData || "",
      removeImage: false,
    });
    loadBranchStock(product.productKey);
    setAdminEditorOpen(true);
  }

  async function handleImageChange(event, productKey) {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageData = await fileToDataUrl(file);
    handleEditorChange(productKey, "imageData", imageData);
    handleEditorChange(productKey, "removeImage", false);
  }

  async function handleSave(productKey) {
    if (!activeEditor || activeEditor.productKey !== productKey) return;
    startTransition(async () => {
      const response = await fetch(`/api/products/${productKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeEditor),
      });
      if (!response.ok) return;
      const payload = await response.json();
      setProducts((current) =>
        current.map((product) =>
          product.productKey === productKey ? payload.producto : product,
        ),
      );
      setActiveEditor(null);
      setAdminEditorOpen(false);
    });
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <div className="header-brand">
          <button className="logo-link logo-button" onClick={() => navigateTo("inicio")} type="button">
            <BrandLogo compact />
          </button>
        </div>

        <nav className="main-nav">
          {[
            ["inicio", "Inicio"],
            ["catalogo", "Catalogo"],
            ["sobre-nosotros", "Sobre nosotros"],
            ["contacto", "Contacto"],
          ].map(([view, label]) => (
            <button
              key={view}
              className={activeView === view ? "nav-pill active" : "nav-pill"}
              onClick={() => navigateTo(view)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <a
            className="header-link"
            href={buildContactLink("Hola, quiero hacer una consulta sobre Manarey.", "Consulta Manarey")}
            target="_blank"
            rel="noreferrer"
          >
            {whatsappNumber ? "WhatsApp" : "Correo"}
          </a>

          {/* Cuenta / sesión unificada */}
          {session.isAdmin ? (
            <div className="customer-badge">
              <span className="customer-hello">👤 Admin</span>
              <button className="customer-logout-btn" onClick={handleLogout} type="button">
                Salir
              </button>
            </div>
          ) : catalogCustomer ? (
            <div className="customer-badge">
              <span className="customer-hello">Hola, {catalogCustomer.nombre}</span>
              <button className="customer-logout-btn" onClick={handleCustomerLogout} type="button">
                Salir
              </button>
            </div>
          ) : (
            <button
              className="customer-login-btn"
              onClick={() => { setLoginOpen(true); setLoginError(""); setLoginData({ username: "", password: "" }); }}
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Iniciar sesión
            </button>
          )}

          <button className="cart-button" onClick={() => setCartOpen(true)} type="button">
            Carrito <span>{cartCount}</span>
          </button>
        </div>
      </header>

      <section className="service-ribbon">
        <div className="service-pill">
          <strong>🏠 {storeBranches.length} sucursales</strong>
          <span>Retiro en local o envio a domicilio</span>
        </div>
        <div className="service-pill">
          <strong>💳 Tarjeta, transferencia y QR</strong>
          <span>Paga como prefieras</span>
        </div>
        <div className="service-pill">
          <strong>💬 WhatsApp</strong>
          <span>Atencion y cierre de venta personalizado</span>
        </div>
      </section>

      <div className="view-stack">
        {catalogError ? (
          <section className="warning-banner">
            No se pudo conectar con la base de datos en este momento. La web sigue funcionando, pero
            los productos no estan cargados.
          </section>
        ) : null}

        {activeView === "inicio" ? (
          <>
            <section className="hero-home">
              <div className="hero-home-copy">
                <p className="eyebrow">Muebleria Manarey</p>
                <h1>Muebles y articulos del hogar para cada ambiente.</h1>
                <div className="hero-home-actions">
                  <button className="hero-buy-button" onClick={() => navigateTo("catalogo")} type="button">
                    Ver catalogo
                  </button>
                  <a
                    className="ghost-button"
                    href={buildContactLink(
                      "Hola, quiero consultar por los productos de Manarey.",
                      "Consulta Manarey",
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {whatsappNumber ? "Consultar por WhatsApp" : "Consultar por correo"}
                  </a>
                </div>
              </div>

              <div className="hero-home-brand">
                <div className="brand-panel editorial">
                  {featuredMainProduct?.imageData ? (
                    <img alt={featuredMainProduct.nombre} className="product-image" loading="lazy" src={featuredMainProduct.imageData} />
                  ) : (
                    <ProductPlaceholder title="Seleccion destacada" />
                  )}
                  <div className="brand-panel-overlay">
                    <p className="eyebrow">Destacado</p>
                    <h2>{featuredMainProduct?.nombre || "Coleccion Manarey"}</h2>
                    {featuredMainProduct ? (
                      <p>{currencyFormatter.format(featuredMainProduct.precioVenta)}</p>
                    ) : null}
                    {featuredMainProduct ? (
                      <div className="showcase-overlay-actions" style={{ marginTop: 14 }}>
                        <button className="primary-button" onClick={() => openProductDetail(featuredMainProduct)} type="button">
                          Ver producto
                        </button>
                        <button className="ghost-button" onClick={() => { addToCart(featuredMainProduct); }} type="button">
                          Agregar al carrito
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="home-invite reveal-block" data-reveal>
              <div className="invite-copy">
                <p className="eyebrow">Categorias</p>
                <h2>¿Que estas buscando?</h2>
              </div>
              <div className="category-highlight-grid">
                {heroCategories.map((item) => (
                  <button
                    key={item}
                    className="category-highlight-card"
                    onClick={() => {
                      setHomeCategory(item);
                      setCategory(item);
                      navigateTo("catalogo");
                    }}
                    type="button"
                  >
                    <span>{item}</span>
                    <strong>Ver productos</strong>
                  </button>
                ))}
              </div>
            </section>

            {!catalogError ? (
              <section className="showcase-section reveal-block" data-reveal>
                <div className="showcase-heading">
                  <div>
                    <p className="eyebrow">Productos destacados</p>
                    <h2>{homeCategory || "Lo mas vendido"}</h2>
                  </div>
                  <div className="showcase-top">
                    {categories
                      .filter((item) => item !== "todas")
                      .slice(0, 9)
                      .map((item) => (
                        <button
                          key={item}
                          className={homeCategory === item ? "showcase-tab active" : "showcase-tab"}
                          onClick={() => setHomeCategory(item)}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="showcase-grid">
                  <article className="showcase-main-card">
                    <div className="showcase-main-visual">
                      {featuredMainProduct?.imageData ? (
                        <img
                          alt={featuredMainProduct.nombre}
                          className="product-image"
                          src={featuredMainProduct.imageData}
                        />
                      ) : (
                        <ProductPlaceholder title={homeCategory || "Destacado"} />
                      )}
                      <div className="showcase-overlay">
                        <h3>{featuredMainProduct?.nombre || homeCategory || "Destacado"}</h3>
                        {featuredMainProduct ? (
                          <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>{currencyFormatter.format(featuredMainProduct.precioVenta)}</p>
                        ) : null}
                        <div className="showcase-overlay-actions">
                          {featuredMainProduct ? (
                            <button
                              className="primary-button"
                              onClick={() => openProductDetail(featuredMainProduct)}
                              type="button"
                            >
                              Ver producto
                            </button>
                          ) : null}
                          <button className="ghost-button" onClick={() => { setCategory(homeCategory || "todas"); navigateTo("catalogo"); }} type="button">
                            Ver todos
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="showcase-side-grid">
                    {featuredSideProducts.map((product) => (
                      <button
                        className="showcase-mini-card"
                        key={product.productKey}
                        onClick={() => openProductDetail(product)}
                        type="button"
                      >
                        <div className="showcase-mini-visual">
                          {product.imageData ? (
                            <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                          ) : (
                            <ProductPlaceholder compact title={product.nombre} />
                          )}
                        </div>
                        <div className="showcase-mini-copy">
                          <h4>{product.nombre}</h4>
                          <p style={{ fontWeight: 700, color: "var(--gold-strong)" }}>{currencyFormatter.format(product.precioVenta)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="showcase-section reveal-block" data-reveal>
              <div className="showcase-heading">
                <div>
                  <p className="eyebrow">Nuestras sucursales</p>
                  <h2>Veni a conocer nuestros showrooms.</h2>
                </div>
              </div>

              <div className="showcase-grid">
                <article className="showcase-main-card" style={{ cursor: "default" }}>
                  <div className="showcase-main-visual">
                    <ProductPlaceholder title="" />
                    <div className="showcase-overlay">
                      <h3>Retirar en local o recibir en casa</h3>
                      <p>Tenemos {storeBranches.length} sucursales. Podés retirar tu compra sin costo adicional o coordinar el envio.</p>
                      <div className="showcase-overlay-actions">
                        <button className="primary-button" onClick={() => navigateTo("sobre-nosotros")} type="button">
                          Ver direcciones
                        </button>
                      </div>
                    </div>
                  </div>
                </article>

                <div className="showcase-side-grid">
                  {storeBranches.slice(0, 4).map((branch) => (
                    <article className="showcase-mini-card" key={branch.id}>
                      <div className="showcase-mini-visual">
                        <ProductPlaceholder compact title="" />
                      </div>
                      <div className="showcase-mini-copy">
                        <p>{branch.address}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activeView === "catalogo" ? (
          <>
            <section className="catalog-hero">
              <p className="eyebrow">Catalogo</p>
              <h2>Todos nuestros productos</h2>
            </section>

            {!catalogError ? (
              <>
                <section className="catalog-tools">
                  <div className="catalog-toolbar">
                    <input
                      className="search-input"
                      placeholder="Buscar por nombre, categoria, medida o descripcion"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <select
                      className="sort-select"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      <option value="relevancia">Ordenar: destacados</option>
                      <option value="precio-asc">Precio: menor a mayor</option>
                      <option value="precio-desc">Precio: mayor a menor</option>
                      <option value="nombre">Nombre</option>
                    </select>
                  </div>

                  <div className="category-rail">
                    {categories.map((item) => (
                      <button
                        key={item}
                        className={category === item ? "category-pill active" : "category-pill"}
                        onClick={() => setCategory(item)}
                        type="button"
                      >
                        {item === "todas" ? "Todas" : item}
                      </button>
                    ))}
                  </div>

                  <div className="catalog-summary">
                    <span>{filteredGroups.length} resultados</span>
                    <span>{inStockCount} disponibles</span>
                    <span>{whatsappNumber ? "Compra por WhatsApp y tarjeta" : "Compra por tarjeta"}</span>
                  </div>
                </section>

                {session.isAdmin ? (
                  <div className="admin-filter-bar">
                    <div className="admin-filter-group">
                      <button
                        className="admin-filter-pill"
                        type="button"
                        onClick={async () => {
                          setShippingFormMsg("");
                          try {
                            const res = await fetch("/api/admin/settings");
                            const data = await res.json();
                            setShippingForm({
                              baseCost: String(data.shippingBaseCost ?? ""),
                              perKm: String(data.shippingCostPerKm ?? ""),
                            });
                          } catch {
                            setShippingForm({ baseCost: "", perKm: "" });
                          }
                          setShippingSettingsOpen(true);
                        }}
                      >
                        ⚙️ Precios de envío
                      </button>
                    </div>
                    <div className="admin-filter-group">
                      <span className="admin-filter-label">Foto:</span>
                      {["todos", "sin-foto", "con-foto"].map((f) => (
                        <button
                          key={f}
                          className={`admin-filter-pill${adminPhotoFilter === f ? " active" : ""}`}
                          onClick={() => setAdminPhotoFilter(f)}
                          type="button"
                        >
                          {f === "todos" ? "Todos" : f === "sin-foto" ? "Sin foto" : "Con foto"}
                        </button>
                      ))}
                    </div>
                    <div className="admin-filter-group">
                      <span className="admin-filter-label">Sucursal:</span>
                      <button
                        className={`admin-filter-pill${adminBranchFilter === "" ? " active" : ""}`}
                        onClick={() => setAdminBranchFilter("")}
                        type="button"
                      >
                        Todas
                      </button>
                      {storeBranches.map((b) => (
                        <button
                          key={b.name}
                          className={`admin-filter-pill${adminBranchFilter === b.name ? " active" : ""}`}
                          onClick={() => setAdminBranchFilter(b.name)}
                          type="button"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Banner de stock por sucursal */}
                {session.isAdmin && adminBranchFilter && Object.keys(branchStockCache).length > 0 ? (() => {
                  const conStock = filteredGroups.filter((g) =>
                    (branchStockCache[g.variants[0]?.productKey]?.find((b) => b.local === adminBranchFilter)?.stock ?? 0) > 0
                  ).length;
                  const totalUnidades = filteredGroups.reduce((acc, g) =>
                    acc + (branchStockCache[g.variants[0]?.productKey]?.find((b) => b.local === adminBranchFilter)?.stock ?? 0), 0
                  );
                  return (
                    <div className="branch-stock-banner">
                      <span className="branch-stock-banner-local">📦 {adminBranchFilter}</span>
                      <span className="branch-stock-banner-stat"><strong>{conStock}</strong> productos con stock</span>
                      <span className="branch-stock-banner-stat"><strong>{totalUnidades}</strong> unidades en total</span>
                    </div>
                  );
                })() : null}

                <section className="catalog-grid">
                  {filteredGroups.length === 0 ? (
                    <article className="empty-state">
                      <p className="eyebrow">Sin resultados</p>
                      <h3>No encontramos productos con ese filtro.</h3>
                      <p>Prueba otra categoria o un termino mas general.</p>
                    </article>
                  ) : null}

                  {filteredGroups.map((group) => {
                    const product = getActiveVariant(group.key, group.variants);
                    const measureMeta = getMeasureMeta(product.medida);
                    const editing = activeEditor?.productKey === product.productKey;
                    const shortDescription = (product.description || "").trim().slice(0, 130);
                    const hasVariants = group.variants.length > 1 && group.variants.some((v) => v.color);
                    const branchStock = adminBranchFilter ? branchStockCache[product.productKey] : null;
                    const branchRow = branchStock ? branchStock.find((b) => b.local === adminBranchFilter) : null;

                    return (
                      <article className="product-card" key={group.key}>
                        <button
                          className="image-frame image-frame-btn"
                          style={{ position: "relative" }}
                          onClick={() => openProductDetail(product)}
                          type="button"
                          aria-label={`Ver detalle de ${product.nombre}`}
                        >
                          {product.imageData ? (
                            <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                          ) : (
                            <div className="image-placeholder">
                              <BrandLogo compact />
                            </div>
                          )}
                          {session.isAdmin && !product.imageData ? (
                            <span className="admin-no-photo-badge">Sin foto</span>
                          ) : null}
                        </button>

                        {hasVariants ? (
                          <div className="color-swatches">
                            {group.variants.map((v) => (
                              <button
                                key={v.productKey}
                                className={`color-swatch${product.productKey === v.productKey ? " active" : ""}`}
                                title={v.color || ""}
                                onClick={() =>
                                  setSelectedVariants((prev) => ({ ...prev, [group.key]: v.productKey }))
                                }
                                type="button"
                              >
                                <span className="color-swatch-dot" />
                                <span className="color-swatch-label">{v.color}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="product-copy">
                          <div className="product-header">
                            <div>
                              <p className="product-category">{product.categoria || "Sin categoria"}</p>
                              <h2>{product.nombre}</h2>
                            </div>
                            <span className={product.isSoldOut ? "stock-pill sold-out" : "stock-pill in-stock"}>
                              {product.isSoldOut ? "Agotado" : "Disponible"}
                            </span>
                          </div>

                          {measureMeta ? (
                            <p className="meta-line">
                              <strong>{measureMeta.label}:</strong> {measureMeta.value}
                            </p>
                          ) : null}

                          <p className="price-tag">{currencyFormatter.format(product.precioVenta)}</p>

                          {session.isAdmin && adminBranchFilter ? (
                            <div className="branch-stock-row">
                              <span className="branch-stock-label">{adminBranchFilter}:</span>
                              {branchStockCache[product.productKey] ? (
                                <>
                                  <button
                                    className="stock-btn"
                                    disabled={stockUpdating[`${product.productKey}::${adminBranchFilter}`]}
                                    onClick={() => updateBranchStock(product.productKey, adminBranchFilter, -1)}
                                    type="button"
                                  >−</button>
                                  <span className="branch-stock-count">
                                    {branchStockCache[product.productKey].find((b) => b.local === adminBranchFilter)?.stock ?? 0}
                                  </span>
                                  <button
                                    className="stock-btn"
                                    disabled={stockUpdating[`${product.productKey}::${adminBranchFilter}`]}
                                    onClick={() => updateBranchStock(product.productKey, adminBranchFilter, 1)}
                                    type="button"
                                  >+</button>
                                </>
                              ) : (
                                <span className="branch-stock-loading">···</span>
                              )}
                            </div>
                          ) : null}

                          <div className="card-actions">
                            <button className="ghost-button" onClick={() => openProductDetail(product)} type="button">
                              Ver detalle
                            </button>
                            {product.isSoldOut ? (
                              <a className="primary-button" href={buildWhatsAppLink(product)} target="_blank" rel="noreferrer">
                                Consultar
                              </a>
                            ) : (
                              <button className="primary-button" onClick={() => addToCart(product)} type="button">
                                Agregar al carrito
                              </button>
                            )}
                          </div>

                          {session.isAdmin ? (
                            <div className="admin-panel">
                              <button className="secondary-button" onClick={() => openEditor(product)} type="button">
                                ✏️ Editar producto
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {activeView === "sobre-nosotros" ? (
          <>
            <section className="content-hero">
              <p className="eyebrow">Nuestra historia</p>
              <h2>Una empresa familiar con mas de 8 años de trayectoria.</h2>
            </section>

            <section className="about-story">
              <article className="about-story-text">
                <p>
                  Manarey nacio en 2017 como una empresa familiar con un solo objetivo: ofrecer muebles
                  y articulos del hogar de calidad al alcance de todos. Abrimos nuestra primera muebleria
                  en <strong>Miguel Cane 508</strong>, una direccion que sigue siendo parte de nosotros hasta el dia de hoy.
                </p>
                <p>
                  Con mucho esfuerzo y dedicacion, fuimos creciendo año a año. Hoy somos{" "}
                  <strong>5 mublerias</strong> distribuidas en la zona sur del Gran Buenos Aires,
                  y nuestra sucursal central se encuentra en{" "}
                  <strong>Av. Hipolito Yrigoyen 19.051, Longchamps</strong>.
                </p>
                <p>
                  Cada local es atendido por personas comprometidas con dar la mejor atencion,
                  porque seguimos siendo lo que siempre fuimos: una familia que ama lo que hace.
                </p>
                <div className="about-social-links">
                  <a
                    className="about-social-btn about-social-ig"
                    href={storeSettings.instagramUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    @manareymuebleria
                  </a>
                  <a
                    className="about-social-btn about-social-fb"
                    href={storeSettings.facebookUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Manarey Glew
                  </a>
                </div>
              </article>

              <aside className="about-story-branches">
                <p className="eyebrow">Nuestras sucursales</p>
                {storeBranches.map((branch) => (
                  <div className="about-branch-row" key={branch.id}>
                    <span className="about-branch-dot" />
                    <div>
                      <strong>{branch.name === "Longchamps" ? "Central — Longchamps" : branch.name}</strong>
                      <p>{branch.address}</p>
                    </div>
                  </div>
                ))}
              </aside>
            </section>
          </>
        ) : null}

        {activeView === "contacto" ? (
          <>
            <section className="content-hero">
              <p className="eyebrow">Contacto</p>
              <h2>Estamos para ayudarte.</h2>
            </section>

            <section className="contact-grid">
              <article className="contact-box">
                <h3>{whatsappNumber ? "WhatsApp" : "Correo"}</h3>
                <p>Consultas, precios y cierre de venta.</p>
                <a
                  className="contact-link"
                  href={buildContactLink("Hola, quiero hacer una consulta sobre Manarey.", "Consulta Manarey")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {whatsappNumber ? "Escribir por WhatsApp" : "Escribir por correo"}
                </a>
              </article>
              <article className="contact-box">
                <h3>Correo</h3>
                <p>Presupuestos y pedidos especiales.</p>
                <a className="contact-link" href="mailto:leandromanavella2016@gmail.com">
                  leandromanavella2016@gmail.com
                </a>
              </article>
              <article className="contact-box">
                <h3>Catalogo online</h3>
                <p>Explora todos los productos y compra directamente.</p>
                <button className="primary-button" onClick={() => navigateTo("catalogo")} type="button">
                  Ver catalogo
                </button>
              </article>
            </section>

            <section className="about-grid">
              {storeBranches.map((branch) => (
                <article className="info-card" key={branch.id}>
                  <p className="eyebrow">Sucursal</p>
                  <p>{branch.address}</p>
                  <p>{branch.city}</p>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>

      <section className="help-strip">
        <h2>Necesitas ayuda para elegir?</h2>
        <div className="help-grid">
          <article className="help-card">
            <h3>{whatsappNumber ? "WhatsApp" : "Correo"}</h3>
            <p>Atencion rapida para ventas y consultas.</p>
            <a
              className="contact-link"
              href={buildContactLink(
                "Hola, necesito ayuda para elegir un producto de Manarey.",
                "Ayuda para elegir producto",
              )}
              target="_blank"
              rel="noreferrer"
            >
              {whatsappNumber ? "Escribir ahora" : "Escribir por correo"}
            </a>
          </article>
          <article className="help-card">
            <h3>Consulta personalizada</h3>
            <p>Te ayudamos a encontrar el producto ideal segun tu espacio.</p>
            <button className="ghost-button" onClick={() => navigateTo("contacto")} type="button">
              Ir a contacto
            </button>
          </article>
          <article className="help-card">
            <h3>Correo</h3>
            <p>Envianos tu consulta y te respondemos.</p>
            <a className="contact-link" href="mailto:leandromanavella2016@gmail.com">
              Enviar correo
            </a>
          </article>
        </div>
      </section>

      {selectedProduct ? (
        <div className="modal-backdrop" onClick={() => setSelectedProductKey("")}>
          <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="detail-grid">
              <div className="detail-media">
                {selectedProduct.imageData ? (
                  <img alt={selectedProduct.nombre} className="product-image" loading="lazy" src={selectedProduct.imageData} />
                ) : (
                  <div className="image-placeholder detail-placeholder">
                    <BrandLogo />
                  </div>
                )}
              </div>
              <div className="detail-copy">
                <p className="eyebrow">{selectedProduct.categoria || "Producto"}</p>
                <h2>{selectedProduct.nombre}</h2>
                <div className="detail-topline">
                  <p className="detail-price">{currencyFormatter.format(detailTotal)}</p>
                  <span className={selectedProduct.isSoldOut ? "stock-pill sold-out" : "stock-pill in-stock"}>
                    {selectedProduct.isSoldOut ? "Sin stock" : "Listo para consultar"}
                  </span>
                </div>

                {selectedProduct.description ? (
                  <p className="description">{selectedProduct.description}</p>
                ) : session.isAdmin ? (
                  <p className="description">Este producto todavia no tiene una descripcion cargada.</p>
                ) : null}

                <div className="detail-specs">
                  {getMeasureMeta(selectedProduct.medida) ? (
                    <p className="meta-line">
                      <strong>{getMeasureMeta(selectedProduct.medida).label}:</strong>{" "}
                      {getMeasureMeta(selectedProduct.medida).value}
                    </p>
                  ) : null}
                  {selectedProduct.color ? (
                    <p className="meta-line">
                      <strong>Color:</strong> {selectedProduct.color}
                    </p>
                  ) : null}
                  {selectedProduct.altoCm || selectedProduct.anchoCm || selectedProduct.profundidadCm ? (
                    <p className="meta-line">
                      <strong>Alto / Ancho / Prof.:</strong>{" "}
                      {[selectedProduct.altoCm, selectedProduct.anchoCm, selectedProduct.profundidadCm]
                        .filter((v) => v != null)
                        .join(" x ")}{" "}
                      cm
                    </p>
                  ) : null}
                  {selectedProduct.largoCm != null ? (
                    <p className="meta-line"><strong>Largo:</strong> {selectedProduct.largoCm} cm</p>
                  ) : null}
                  {selectedProduct.litros != null ? (
                    <p className="meta-line"><strong>Litros:</strong> {selectedProduct.litros} L</p>
                  ) : null}
                  {selectedProduct.watts != null ? (
                    <p className="meta-line"><strong>Watts:</strong> {selectedProduct.watts} W</p>
                  ) : null}
                  {selectedProduct.pesoKg != null ? (
                    <p className="meta-line"><strong>Peso:</strong> {selectedProduct.pesoKg} kg</p>
                  ) : null}
                  {selectedProduct.voltaje ? (
                    <p className="meta-line"><strong>Voltaje:</strong> {selectedProduct.voltaje}</p>
                  ) : null}
                  {selectedProduct.material ? (
                    <p className="meta-line"><strong>Material:</strong> {selectedProduct.material}</p>
                  ) : null}
                  {selectedProduct.capacidad ? (
                    <p className="meta-line"><strong>Capacidad:</strong> {selectedProduct.capacidad}</p>
                  ) : null}
                </div>

                {(() => {
                  const group = filteredGroups.find((g) =>
                    g.variants.some((v) => v.productKey === selectedProduct.productKey),
                  );
                  const hasModalVariants = group && group.variants.length > 1 && group.variants.some((v) => v.color);
                  if (!hasModalVariants) return null;
                  return (
                    <div className="modal-color-swatches">
                      <p className="meta-line" style={{ marginBottom: 6 }}><strong>Color:</strong></p>
                      <div className="color-swatches">
                        {group.variants.map((v) => (
                          <button
                            key={v.productKey}
                            className={`color-swatch${selectedProduct.productKey === v.productKey ? " active" : ""}`}
                            title={v.color || ""}
                            onClick={() => setSelectedProductKey(v.productKey)}
                            type="button"
                          >
                            <span className="color-swatch-dot" />
                            <span className="color-swatch-label">{v.color}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {supportsAccessory(selectedProduct) && accessoryProduct ? (
                  <label className="accessory-box">
                    <input
                      checked={detailAccessorySelected}
                      onChange={(event) => setDetailAccessorySelected(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      Quieres agregar {accessoryProduct.nombre}?
                      <strong> + {currencyFormatter.format(accessoryProduct.precioVenta)}</strong>
                    </span>
                  </label>
                ) : null}

                <div className="detail-actions">
                  <button className="ghost-button" onClick={() => setSelectedProductKey("")} type="button">
                    Cerrar
                  </button>
                  <a
                    className="ghost-button"
                    href={buildWhatsAppLink(selectedProduct, detailAccessorySelected)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {whatsappNumber ? "Consultar por WhatsApp" : "Consultar por correo"}
                  </a>
                  {!selectedProduct.isSoldOut ? (
                    <button
                      className="primary-button"
                      onClick={() =>
                        addToCart(selectedProduct, { accessorySelected: detailAccessorySelected })
                      }
                      type="button"
                    >
                      Agregar al carrito
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {relatedProducts.length ? (
              <div className="related-section">
                <p className="eyebrow">Productos relacionados</p>
                <div className="related-grid">
                  {relatedProducts.map((product) => (
                    <button
                      className="related-card"
                      key={product.productKey}
                      onClick={() => openProductDetail(product)}
                      type="button"
                    >
                      <div className="related-visual">
                        {product.imageData ? (
                          <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                        ) : (
                          <ProductPlaceholder compact title={product.nombre} />
                        )}
                      </div>
                      <div className="related-copy">
                        <p>{product.nombre}</p>
                        <strong>{currencyFormatter.format(product.precioVenta)}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Modal editor admin — full screen en mobile */}
      {adminEditorOpen && activeEditor ? (
        <div className="modal-backdrop" onClick={() => { setAdminEditorOpen(false); setActiveEditor(null); }}>
          <div className="admin-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3 className="admin-editor-title">
                ✏️ Editar producto
                {activeEditor && products.find(p => p.productKey === activeEditor.productKey)?.nombre
                  ? ` — ${products.find(p => p.productKey === activeEditor.productKey).nombre}`
                  : ""}
              </h3>
              <button className="admin-editor-close" onClick={() => { setAdminEditorOpen(false); setActiveEditor(null); }} type="button">✕</button>
            </div>

            <div className="admin-editor-body">
              {/* Foto */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📷 Foto del producto</p>
                {activeEditor.imageData ? (
                  <div className="admin-editor-preview">
                    <img src={activeEditor.imageData} alt="Preview" className="admin-editor-img" />
                    <button className="ghost-button" onClick={() => { handleEditorChange(activeEditor.productKey, "imageData", ""); handleEditorChange(activeEditor.productKey, "removeImage", true); }} type="button">
                      Quitar foto
                    </button>
                  </div>
                ) : (
                  <label className="upload-button admin-upload-btn">
                    📷 Subir foto
                    <input accept="image/*" capture="environment" hidden type="file"
                      onChange={(event) => handleImageChange(event, activeEditor.productKey)} />
                  </label>
                )}
              </div>

              {/* Precio */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">💲 Precio de venta</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Precio del sistema: <strong>{currencyFormatter.format(activeEditor.precioOriginal || 0)}</strong>.
                  Dejá en blanco para usar ese precio, o ingresá uno distinto.
                </p>
                <input
                  className="editor-input"
                  type="number"
                  min="0"
                  step="100"
                  placeholder={String(activeEditor.precioOriginal || "")}
                  value={activeEditor.precioVenta}
                  onChange={(e) => handleEditorChange(activeEditor.productKey, "precioVenta", e.target.value)}
                  style={{ maxWidth: 180 }}
                />
              </div>

              {/* Descripcion */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📝 Descripcion</p>
                <textarea
                  className="editor-textarea admin-editor-textarea"
                  placeholder="Describe el producto: materiales, características, usos..."
                  value={activeEditor.description}
                  rows={5}
                  onChange={(e) => handleEditorChange(activeEditor.productKey, "description", e.target.value)}
                />
              </div>

              {/* Medidas */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📐 Medidas</p>
                <div className="admin-editor-fields">
                  {[
                    ["altoCm",       "Alto (cm)"],
                    ["anchoCm",      "Ancho (cm)"],
                    ["profundidadCm","Profundidad (cm)"],
                    ["largoCm",      "Largo (cm)"],
                  ].map(([field, label]) => (
                    <label key={field} className="admin-field-label">
                      <span>{label}</span>
                      <input className="editor-input" type="number" placeholder="—"
                        value={activeEditor[field]}
                        onChange={(e) => handleEditorChange(activeEditor.productKey, field, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Especificaciones técnicas */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">⚡ Especificaciones técnicas</p>
                <div className="admin-editor-fields">
                  {[
                    ["litros",   "Litros"],
                    ["watts",    "Watts"],
                    ["pesoKg",   "Peso (kg)"],
                    ["voltaje",  "Voltaje"],
                    ["material", "Material"],
                    ["capacidad","Capacidad"],
                  ].map(([field, label]) => (
                    <label key={field} className="admin-field-label">
                      <span>{label}</span>
                      <input className="editor-input" placeholder="—"
                        value={activeEditor[field]}
                        onChange={(e) => handleEditorChange(activeEditor.productKey, field, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Stock por sucursal */}
              {branchStockCache[activeEditor.productKey] ? (
                <div className="admin-editor-section">
                  <p className="admin-editor-section-title">📦 Stock por sucursal</p>
                  <div className="editor-branch-stock">
                    {branchStockCache[activeEditor.productKey].map((b) => (
                      <div key={b.local} className="editor-branch-row">
                        <span className="editor-branch-name">{b.local}</span>
                        <button className="stock-btn" disabled={stockUpdating[`${activeEditor.productKey}::${b.local}`]}
                          onClick={() => updateBranchStock(activeEditor.productKey, b.local, -1)} type="button">−</button>
                        <span className="branch-stock-count">{b.stock}</span>
                        <button className="stock-btn" disabled={stockUpdating[`${activeEditor.productKey}::${b.local}`]}
                          onClick={() => updateBranchStock(activeEditor.productKey, b.local, 1)} type="button">+</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="admin-editor-section">
                  <p className="admin-editor-section-title">📦 Stock por sucursal</p>
                  <button className="ghost-button" onClick={() => loadBranchStock(activeEditor.productKey)} type="button">
                    Cargar stock
                  </button>
                </div>
              )}
            </div>

            <div className="admin-editor-footer">
              <button className="ghost-button" onClick={() => { setAdminEditorOpen(false); setActiveEditor(null); }} type="button">
                Cancelar
              </button>
              <button className="primary-button" disabled={pending}
                onClick={() => handleSave(activeEditor.productKey)} type="button">
                {pending ? "Guardando..." : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal unificado: Iniciar sesión / Registrarse */}
      {loginOpen ? (
        <div className="modal-backdrop" onClick={() => setLoginOpen(false)}>
          <div className="cauth-modal" onClick={(event) => event.stopPropagation()}>
            <button className="cauth-close" onClick={() => setLoginOpen(false)} type="button" aria-label="Cerrar">✕</button>

            <p className="eyebrow" style={{ marginBottom: 4 }}>Manarey</p>
            <h3 className="cauth-title">
              {customerAuthMode === "login" ? "Ingresá a tu cuenta" : "Crear cuenta"}
            </h3>

            {/* Google */}
            <a href="/api/auth/google" className="cauth-google-btn">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.39a4.61 4.61 0 01-2 3.03v2.52h3.24c1.9-1.75 3-4.32 3-7.34z" fill="#4285F4"/>
                <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.6A10 10 0 0010 20z" fill="#34A853"/>
                <path d="M4.41 11.89A6.01 6.01 0 014.1 10c0-.66.11-1.3.31-1.89V5.51H1.07A10 10 0 000 10c0 1.61.39 3.13 1.07 4.49l3.34-2.6z" fill="#FBBC05"/>
                <path d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.69 0 10 0A10 10 0 001.07 5.51l3.34 2.6C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </a>

            <div className="cauth-divider"><span>o con email</span></div>

            {/* Tabs */}
            <div className="cauth-tabs">
              <button
                className={`cauth-tab${customerAuthMode === "login" ? " active" : ""}`}
                onClick={() => { setCustomerAuthMode("login"); setCustomerAuthError(""); setLoginError(""); }}
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className={`cauth-tab${customerAuthMode === "register" ? " active" : ""}`}
                onClick={() => { setCustomerAuthMode("register"); setCustomerAuthError(""); setLoginError(""); }}
                type="button"
              >
                Registrarse
              </button>
            </div>

            {/* Formulario según tab */}
            {customerAuthMode === "login" ? (
              <form className="cauth-form" onSubmit={handleLogin}>
                <input
                  className="cauth-input"
                  placeholder="Usuario o correo electrónico"
                  type="text"
                  autoComplete="username"
                  value={loginData.username}
                  onChange={(e) => setLoginData((d) => ({ ...d, username: e.target.value }))}
                  required
                />
                <input
                  className="cauth-input"
                  placeholder="Contraseña"
                  type="password"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData((d) => ({ ...d, password: e.target.value }))}
                  required
                />
                {loginError ? <p className="cauth-error">{loginError}</p> : null}
                <button className="cauth-submit" type="submit">
                  Ingresar
                </button>
              </form>
            ) : (
              <form className="cauth-form" onSubmit={handleCustomerAuth}>
                <div className="cauth-row">
                  <input
                    className="cauth-input"
                    placeholder="Nombre"
                    value={customerAuthData.nombre}
                    onChange={(e) => setCustomerAuthData((d) => ({ ...d, nombre: e.target.value }))}
                    required
                  />
                  <input
                    className="cauth-input"
                    placeholder="Apellido"
                    value={customerAuthData.apellido}
                    onChange={(e) => setCustomerAuthData((d) => ({ ...d, apellido: e.target.value }))}
                    required
                  />
                </div>
                <input
                  className="cauth-input"
                  type="tel"
                  placeholder="Teléfono (para recibir novedades por WhatsApp)"
                  value={customerAuthData.telefono}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, telefono: e.target.value }))}
                />
                <input
                  className="cauth-input"
                  type="email"
                  placeholder="Correo electrónico"
                  value={customerAuthData.email}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, email: e.target.value }))}
                  required
                />
                <input
                  className="cauth-input"
                  type="password"
                  placeholder="Contraseña (mínimo 6 caracteres)"
                  value={customerAuthData.password}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, password: e.target.value }))}
                  required
                />
                {customerAuthError && <p className="cauth-error">{customerAuthError}</p>}
                <button className="cauth-submit" type="submit" disabled={customerAuthBusy}>
                  {customerAuthBusy ? "Procesando..." : "Crear cuenta"}
                </button>
                <p className="cauth-legal">
                  Al registrarte podés recibir novedades y ofertas de Manarey por WhatsApp.
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="cart-drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="cart-header">
              <div>
                <p className="eyebrow">Carrito</p>
                <h3>Tu seleccion</h3>
              </div>
              <button className="ghost-button" onClick={() => setCartOpen(false)} type="button">
                Cerrar
              </button>
            </div>
            {cart.length === 0 ? (
              <p className="availability">Todavia no agregaste productos.</p>
            ) : (
              <>
                <div className="cart-list">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.lineKey}>
                      <div>
                        <p className="cart-name">{item.nombre}</p>
                        {item.accessoryLabel ? <p className="cart-extra">Con {item.accessoryLabel}</p> : null}
                        <p className="cart-price">
                          {currencyFormatter.format(item.precioVenta + (item.accessoryPrice || 0))} × {item.quantity}
                        </p>
                      </div>
                      <div className="cart-quantity">
                        <button onClick={() => changeCartQuantity(item.lineKey, -1)} type="button">
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeCartQuantity(item.lineKey, 1)} type="button">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-footer">
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 2 }}>Subtotal</p>
                    <strong style={{ fontSize: "1.3rem" }}>{currencyFormatter.format(checkoutSummary.subtotal)}</strong>
                  </div>
                </div>
                <div className="cart-checkout-actions">
                  <a className="cart-checkout" href="/checkout">
                    Finalizar compra →
                  </a>
                  <p className="availability" style={{ margin: 0, textAlign: "center", fontSize: "0.82rem" }}>
                    Elegis envio, forma de pago y mas en el siguiente paso.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {/* Modal configuración de envío */}
      {shippingSettingsOpen && (
        <div className="modal-backdrop" onClick={() => setShippingSettingsOpen(false)}>
          <div className="admin-editor-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3 className="admin-editor-title">⚙️ Precios de envío</h3>
              <button className="admin-editor-close" onClick={() => setShippingSettingsOpen(false)} type="button">✕</button>
            </div>
            <div className="admin-editor-body">
              <p style={{ marginBottom: 4, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                El envío se calcula desde Longchamps o Glew (la más cercana al cliente).
              </p>
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">Costo base ($)</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Se cobra siempre, independientemente de la distancia.
                </p>
                <input
                  className="cf-input"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="Ej: 10000"
                  value={shippingForm.baseCost}
                  onChange={(e) => setShippingForm((f) => ({ ...f, baseCost: e.target.value }))}
                />
              </div>
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">Costo por km ($)</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Se multiplica por los km desde la sucursal hasta el domicilio.
                </p>
                <input
                  className="cf-input"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ej: 1500"
                  value={shippingForm.perKm}
                  onChange={(e) => setShippingForm((f) => ({ ...f, perKm: e.target.value }))}
                />
              </div>
              {shippingForm.baseCost && shippingForm.perKm && (
                <p style={{ fontSize: "0.85rem", color: "var(--gold)", margin: "8px 0" }}>
                  Ejemplo: 20 km → ${(Number(shippingForm.baseCost) + 20 * Number(shippingForm.perKm)).toLocaleString("es-AR")}
                </p>
              )}
              {shippingFormMsg && (
                <p style={{ color: shippingFormMsg.startsWith("✅") ? "var(--gold)" : "#c0392b", fontSize: "0.88rem" }}>
                  {shippingFormMsg}
                </p>
              )}
              <button
                className="cf-btn-primary"
                style={{ marginTop: 8 }}
                disabled={shippingFormBusy}
                type="button"
                onClick={async () => {
                  setShippingFormBusy(true);
                  setShippingFormMsg("");
                  try {
                    const res = await fetch("/api/admin/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        shippingBaseCost: Number(shippingForm.baseCost),
                        shippingCostPerKm: Number(shippingForm.perKm),
                      }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Error al guardar.");
                    }
                    setShippingFormMsg("✅ Precios actualizados correctamente.");
                  } catch (err) {
                    setShippingFormMsg(err.message || "Error al guardar.");
                  } finally {
                    setShippingFormBusy(false);
                  }
                }}
              >
                {shippingFormBusy ? "Guardando..." : "Guardar precios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Botón flotante WhatsApp ─────────────────────────────────────────── */}
      {whatsappNumber && (
        <a
          className="wsp-fab"
          href={buildContactLink("Hola, quiero consultar sobre un producto de Manarey.", "Consulta Manarey")}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Consultar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span>Consultar</span>
        </a>
      )}

      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <p className="eyebrow">Manarey</p>
            <h3>Muebles y articulos del hogar.</h3>
            <p className="footer-tagline">Empresa familiar desde 2017 · 5 sucursales en el sur del GBA</p>
          </div>
          {whatsappNumber && (
            <a
              className="footer-wsp-btn"
              href={buildContactLink("Hola, quiero hacer una consulta sobre Manarey.", "Consulta Manarey")}
              target="_blank"
              rel="noreferrer noopener"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Escribinos por WhatsApp
            </a>
          )}
        </div>
        <div className="footer-grid">
          <div>
            <strong>Catálogo</strong>
            <p>Compra por carrito, tarjeta, transferencia o WhatsApp.</p>
          </div>
          <div>
            <strong>Sucursales</strong>
            <p>5 locales en la zona sur del Gran Buenos Aires. Central en Longchamps.</p>
          </div>
          <div>
            <strong>Contacto</strong>
            <p>+54 9 11 6428-2270</p>
            <p style={{ fontSize: "0.82rem", opacity: 0.7 }}>{contactEmail}</p>
          </div>
          <div>
            <strong>Seguinos</strong>
            <div className="footer-social">
              <a href={storeSettings.instagramUrl} target="_blank" rel="noreferrer noopener" className="footer-social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                @manareymuebleria
              </a>
              <a href={storeSettings.facebookUrl} target="_blank" rel="noreferrer noopener" className="footer-social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Manarey Glew
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
