(function () {
  "use strict";

  const companies = window.STARTUPS || [];
  const meta = window.RADAR_META || {};
  const colors = meta.categoryColors || {};
  const confidenceLabels = meta.confidenceLabels || {};

  const state = {
    category: "all",
    query: "",
    disclosedOnly: false,
    lastTrigger: null
  };

  const els = {
    categoryFilters: document.getElementById("categoryFilters"),
    searchInput: document.getElementById("searchInput"),
    disclosedOnly: document.getElementById("disclosedOnly"),
    radarPoints: document.getElementById("radarPoints"),
    radarEmpty: document.getElementById("radarEmpty"),
    companyGrid: document.getElementById("companyGrid"),
    visibleCount: document.getElementById("visibleCount"),
    companyCount: document.getElementById("companyCount"),
    drawerShell: document.getElementById("drawerShell"),
    drawerBackdrop: document.getElementById("drawerBackdrop"),
    drawerContent: document.getElementById("drawerContent")
  };

  const categoryNames = Object.fromEntries((meta.categories || []).map((category) => [category.id, category.label]));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function companyInitials(name) {
    return name
      .replace("AI", "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  function bubbleSize(company) {
    if (!company.annualScale) return 70;
    return Math.round(Math.min(158, 70 + Math.sqrt(company.annualScale) * 3.55));
  }

  function plotY(score) {
    return Math.max(11, Math.min(86, 103 - Number(score || 20)));
  }

  function normalizedSearchText(company) {
    return [
      company.company,
      company.category,
      company.subCategory,
      company.oneLiner,
      company.pain,
      company.solution,
      company.buyers,
      company.customers
    ].join(" ").toLowerCase();
  }

  function filteredCompanies() {
    const query = state.query.trim().toLowerCase();
    return companies
      .filter((company) => state.category === "all" || company.category === state.category)
      .filter((company) => !state.disclosedOnly || (company.annualScale && ["disclosed", "dated"].includes(company.confidence)))
      .filter((company) => !query || normalizedSearchText(company).includes(query))
      .sort((a, b) => b.evidenceScore - a.evidenceScore);
  }

  function renderFilters() {
    els.categoryFilters.innerHTML = (meta.categories || []).map((category) => `
      <button
        class="filter-pill${state.category === category.id ? " active" : ""}"
        type="button"
        data-category="${escapeHtml(category.id)}"
        aria-pressed="${state.category === category.id}"
      >${escapeHtml(category.label)}</button>
    `).join("");
  }

  function renderRadar(list) {
    els.radarPoints.innerHTML = list.map((company) => {
      const color = colors[company.category] || "#d7ff68";
      const size = bubbleSize(company);
      const metric = company.annualScale ? company.metricValue : "Not public";
      return `
        <button
          class="radar-point"
          type="button"
          data-company="${escapeHtml(company.id)}"
          data-confidence="${escapeHtml(company.confidence)}"
          style="--x:${company.x}%;--y:${plotY(company.evidenceScore)}%;--size:${size}px;--bubble:${color}"
          aria-label="Open ${escapeHtml(company.company)} details. ${escapeHtml(company.metricValue)}."
        >
          <span class="point-inner">
            <span class="point-name">${escapeHtml(company.company)}</span>
            <span class="point-metric">${escapeHtml(metric)}</span>
          </span>
        </button>
      `;
    }).join("");
    els.radarEmpty.hidden = list.length > 0;
  }

  function renderCards(list) {
    els.companyGrid.innerHTML = list.map((company) => {
      const color = colors[company.category] || "#d7ff68";
      const confidence = confidenceLabels[company.confidence] || company.confidence;
      return `
        <button class="company-card" type="button" data-company="${escapeHtml(company.id)}" style="--category:${color}">
          <span class="card-top">
            <span class="company-monogram" aria-hidden="true">${escapeHtml(companyInitials(company.company))}</span>
            <span class="card-category">${escapeHtml(categoryNames[company.category])}<br>${escapeHtml(company.subCategory)}</span>
          </span>
          <span>
            <h3>${escapeHtml(company.company)}</h3>
            <span class="one-liner">${escapeHtml(company.oneLiner)}</span>
          </span>
          <span class="card-metric">
            <span class="metric-label">${escapeHtml(company.metricLabel)}</span>
            <span class="metric-value">${escapeHtml(company.metricValue)}</span>
            <span class="metric-foot">
              <span>${escapeHtml(company.status)}</span>
              <span class="evidence-chip">${escapeHtml(confidence)}</span>
            </span>
          </span>
        </button>
      `;
    }).join("");
  }

  function render() {
    const list = filteredCompanies();
    renderFilters();
    renderRadar(list);
    renderCards(list);
    els.visibleCount.textContent = String(list.length);
    els.companyCount.textContent = String(companies.length);
  }

  function sourceLinks(company) {
    return (company.sources || []).map((source) => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>
    `).join("");
  }

  function detailBlock(title, body, className = "") {
    return `<section class="detail-block ${className}"><h3>${escapeHtml(title)}</h3>${body}</section>`;
  }

  function openDrawer(companyId, trigger) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    state.lastTrigger = trigger || document.activeElement;
    const color = colors[company.category] || "#d7ff68";
    const confidence = confidenceLabels[company.confidence] || company.confidence;

    els.drawerContent.innerHTML = `
      <div class="drawer-head">
        <span class="drawer-kicker">${escapeHtml(company.status)} · ${escapeHtml(confidence)}</span>
        <button class="drawer-close" id="drawerClose" type="button" aria-label="Close company details">×</button>
      </div>
      <div class="drawer-body" style="--category:${color}">
        <div class="drawer-title-row">
          <h2 id="drawerTitle">${escapeHtml(company.company)}</h2>
          <span class="drawer-category">${escapeHtml(categoryNames[company.category])}</span>
        </div>
        <p class="drawer-summary">${escapeHtml(company.oneLiner)}</p>
        <div class="drawer-financial">
          <span class="metric-label">${escapeHtml(company.metricLabel)}</span>
          <span class="metric-value">${escapeHtml(company.metricValue)}</span>
          <p>${escapeHtml(company.metricNote)}</p>
        </div>
        <div class="detail-grid">
          ${detailBlock("Customer pain", `<p>${escapeHtml(company.pain)}</p>`)}
          ${detailBlock("Core solution", `<p>${escapeHtml(company.solution)}</p>`)}
          ${detailBlock("Buyer", `<p>${escapeHtml(company.buyers)}</p><p><strong>Customer proof:</strong> ${escapeHtml(company.customers)}</p>`)}
          ${detailBlock("Business model", `<p>${escapeHtml(company.monetization)}</p>`)}
          ${detailBlock("Capital", `<p><strong>Funding:</strong> ${escapeHtml(company.funding)}</p><p><strong>Latest public valuation:</strong> ${escapeHtml(company.valuation)}</p><p><strong>Investors:</strong> ${escapeHtml(company.investors)}</p>`, "wide")}
          ${detailBlock("What is commercially proved", `<p>${escapeHtml(company.proof)}</p>`)}
          ${detailBlock("Independent-data opportunity", `<p>${escapeHtml(company.angle)}</p>`)}
          ${detailBlock("What remains hard", `<p>${escapeHtml(company.watchout)}</p>`, "wide")}
          ${detailBlock("Sources", `<ul class="source-list">${sourceLinks(company)}</ul>`, "wide")}
        </div>
      </div>
    `;

    els.drawerShell.hidden = false;
    document.body.classList.add("drawer-open");
    document.getElementById("drawerClose").addEventListener("click", closeDrawer);
    requestAnimationFrame(() => document.getElementById("drawerClose").focus());
    history.replaceState(null, "", `#company=${encodeURIComponent(company.id)}`);
  }

  function closeDrawer() {
    if (els.drawerShell.hidden) return;
    els.drawerShell.hidden = true;
    document.body.classList.remove("drawer-open");
    history.replaceState(null, "", `${location.pathname}${location.search}#radar`);
    if (state.lastTrigger && typeof state.lastTrigger.focus === "function") state.lastTrigger.focus();
  }

  els.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  els.disclosedOnly.addEventListener("change", (event) => {
    state.disclosedOnly = event.target.checked;
    render();
  });

  function handleCompanyClick(event) {
    const target = event.target.closest("[data-company]");
    if (!target) return;
    openDrawer(target.dataset.company, target);
  }

  els.radarPoints.addEventListener("click", handleCompanyClick);
  els.companyGrid.addEventListener("click", handleCompanyClick);
  els.drawerBackdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.drawerShell.hidden) closeDrawer();
  });

  render();

  const hashMatch = location.hash.match(/^#company=(.+)$/);
  if (hashMatch) openDrawer(decodeURIComponent(hashMatch[1]), null);
})();
