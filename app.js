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
    sourceCount: document.getElementById("sourceCount"),
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

  function deterministicUnit(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  const stageYOverrides = {
    liftoff: 13,
    hightouch: 36,
    moloco: 34,
    rokt: 31,
    commerceiq: 46,
    vibe: 43,
    stackline: 29,
    measured: 39,
    appsflyer: 28,
    rockerbox: 47,
    tatari: 46,
    attain: 58,
    voyantis: 61,
    fermat: 57,
    "triple-whale": 68,
    northbeam: 56,
    alembic: 68,
    haus: 59,
    "black-crow": 84,
    proxima: 84,
    replo: 84,
    rebuy: 84
  };

  function plotY(company) {
    if (Number.isFinite(stageYOverrides[company.id])) return stageYOverrides[company.id];
    const bandCenters = {
      public: 13,
      late: 36,
      mid: 58,
      early: 80
    };
    const center = bandCenters[company.maturity] ?? bandCenters.mid;
    const jitter = (deterministicUnit(company.id) - 0.5) * 7;
    return center + jitter;
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
      company.customers,
      company.valuation,
      company.investors,
      company.funding
    ].join(" ").toLowerCase();
  }

  function filteredCompanies() {
    const query = state.query.trim().toLowerCase();
    return companies
      .filter((company) => state.category === "all" || company.category === state.category)
      .filter((company) => !state.disclosedOnly || (company.annualScale && ["disclosed", "dated"].includes(company.confidence)))
      .filter((company) => !query || normalizedSearchText(company).includes(query))
      .sort((a, b) => (Number(b.annualScale) || -1) - (Number(a.annualScale) || -1) || a.company.localeCompare(b.company));
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
          data-maturity="${escapeHtml(company.maturity)}"
          style="--x:${company.x}%;--y:${plotY(company)}%;--size:${size}px;--bubble:${color}"
          aria-label="Open ${escapeHtml(company.company)} details. ${escapeHtml(company.status)}. ${escapeHtml(company.metricValue)}."
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

  const sourcePatterns = {
    company: [/\bproduct\b/i, /\bcompany\b/i, /\bplatform\b/i, /\babout\b/i, /data asset/i, /customers?/i],
    financial: [/arr/i, /revenue/i, /run-rate/i, /prospectus/i, /acquisition price/i, /tracked scale/i],
    valuation: [/valuation/i, /acquisition price/i, /secondary/i, /sec filing/i, /series [a-z]/i],
    customers: [/customer/i, /case/i, /clients/i, /company/i, /product/i],
    investors: [/investor/i, /funding/i, /series [a-z]/i, /capital/i, /valuation/i]
  };

  function sourceFor(company, purpose) {
    const sources = company.sources || [];
    for (const pattern of sourcePatterns[purpose] || []) {
      const source = sources.find((candidate) => pattern.test(candidate.label));
      if (source) return source;
    }
    return sources[0] || null;
  }

  function sourceAnchor(text, source, className = "") {
    const safeText = escapeHtml(text);
    if (!source || !source.url) return `<span class="${escapeHtml(className)}">${safeText}</span>`;
    return `<a class="${escapeHtml(className)}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${safeText}<span class="external-mark" aria-hidden="true">↗</span></a>`;
  }

  function valuationInMillions(value) {
    const match = String(value || "").match(/\$([\d.]+)\s*([BM])/i);
    if (!match) return null;
    return Number(match[1]) * (match[2].toUpperCase() === "B" ? 1000 : 1);
  }

  function headlineMultiple(company) {
    const valuation = valuationInMillions(company.valuation);
    const scale = Number(company.annualScale);
    if (!valuation || !Number.isFinite(scale) || scale <= 0 || company.confidence === "proxy") return "";
    const multiple = valuation / scale;
    const formatted = multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1);
    const basis = /arr/i.test(company.metricLabel) ? "ARR" : /run-rate/i.test(company.metricLabel) ? "run-rate" : "annual scale";
    return `≈${formatted}× cited ${basis}`;
  }

  function capitalLabel(company) {
    if (/^public/i.test(company.status)) return "Public ownership / prior sponsors";
    if (/^acquired/i.test(company.status)) return "Owner / prior capital";
    return "Named investors";
  }

  function renderCards(list) {
    els.companyGrid.innerHTML = list.map((company) => {
      const color = colors[company.category] || "#d7ff68";
      const confidence = confidenceLabels[company.confidence] || company.confidence;
      const companySource = sourceFor(company, "company");
      const financialSource = sourceFor(company, "financial");
      const valuationSource = /not publicly disclosed/i.test(company.valuation) ? null : sourceFor(company, "valuation");
      const customerSource = sourceFor(company, "customers");
      const investorSource = sourceFor(company, "investors");
      const multiple = headlineMultiple(company);
      return `
        <article class="company-card" style="--category:${color}">
          <button class="card-open" type="button" data-company="${escapeHtml(company.id)}" aria-label="Open ${escapeHtml(company.company)} research dossier">
            <span class="sr-only">Open ${escapeHtml(company.company)} research dossier</span>
          </button>
          <div class="card-content">
            <div class="card-top">
              <span class="company-monogram" aria-hidden="true">${escapeHtml(companyInitials(company.company))}</span>
              <span class="card-category">${escapeHtml(categoryNames[company.category])}<br>${escapeHtml(company.subCategory)}</span>
            </div>
            <div class="card-intro">
              <h3>${sourceAnchor(company.company, companySource, "company-source")}</h3>
              <p class="one-liner">${escapeHtml(company.oneLiner)}</p>
            </div>
            <dl class="card-facts">
              <div class="card-fact financial-fact">
                <dt>${escapeHtml(company.metricLabel)}</dt>
                <dd>${sourceAnchor(company.metricValue, financialSource, "metric-source")}</dd>
                <small>${escapeHtml(confidence)}</small>
              </div>
              <div class="card-fact valuation-fact">
                <dt>Latest public valuation</dt>
                <dd>${sourceAnchor(company.valuation, valuationSource, "fact-source")}</dd>
                ${multiple ? `<small title="Latest cited valuation divided by the card's annual-scale field; dates and revenue quality may differ.">${escapeHtml(multiple)} · rough, unnormalized</small>` : ""}
              </div>
              <div class="card-fact wide-fact">
                <dt>Who pays</dt>
                <dd>${sourceAnchor(company.buyers, companySource, "fact-source clamp-two")}</dd>
              </div>
              <div class="card-fact wide-fact">
                <dt>Named customer proof</dt>
                <dd>${sourceAnchor(company.customers, customerSource, "fact-source clamp-two")}</dd>
                <small>Largest customer identity is not public in the reviewed sources; concentration is shown where available.</small>
              </div>
              <div class="card-fact wide-fact investor-fact">
                <dt>${escapeHtml(capitalLabel(company))}</dt>
                <dd>${sourceAnchor(company.investors, investorSource, "fact-source clamp-two")}</dd>
              </div>
            </dl>
            <div class="metric-foot">
              <span>${escapeHtml(company.status)}</span>
              <span class="open-dossier">Open dossier →</span>
            </div>
          </div>
        </article>
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
    els.sourceCount.textContent = String(companies.reduce((total, company) => total + (company.sources || []).length, 0));
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
    const companySource = sourceFor(company, "company");
    const financialSource = sourceFor(company, "financial");
    const valuationSource = /not publicly disclosed/i.test(company.valuation) ? null : sourceFor(company, "valuation");
    const customerSource = sourceFor(company, "customers");
    const investorSource = sourceFor(company, "investors");
    const multiple = headlineMultiple(company);

    els.drawerContent.innerHTML = `
      <div class="drawer-head">
        <span class="drawer-kicker">${escapeHtml(company.status)} · ${escapeHtml(confidence)}</span>
        <button class="drawer-close" id="drawerClose" type="button" aria-label="Close company details">×</button>
      </div>
      <div class="drawer-body" style="--category:${color}">
        <div class="drawer-title-row">
          <h2 id="drawerTitle">${sourceAnchor(company.company, companySource, "drawer-company-link")}</h2>
          <span class="drawer-category">${escapeHtml(categoryNames[company.category])}</span>
        </div>
        <p class="drawer-summary">${escapeHtml(company.oneLiner)}</p>
        <div class="drawer-financial">
          <span class="metric-label">${escapeHtml(company.metricLabel)}</span>
          <span class="metric-value">${sourceAnchor(company.metricValue, financialSource, "drawer-metric-link")}</span>
          <p>${escapeHtml(company.metricNote)}</p>
        </div>
        <div class="detail-grid">
          ${detailBlock("Customer pain", `<p>${escapeHtml(company.pain)}</p>`)}
          ${detailBlock("Core solution", `<p>${escapeHtml(company.solution)}</p>`)}
          ${detailBlock("Who pays", `<p>${sourceAnchor(company.buyers, companySource, "detail-source-link")}</p><p><strong>Named customer proof:</strong> ${sourceAnchor(company.customers, customerSource, "detail-source-link")}</p><p class="disclosure-note">Largest customer identity is not public in the reviewed sources; concentration is shown where available.</p>`)}
          ${detailBlock("Business model", `<p>${escapeHtml(company.monetization)}</p>`)}
          ${detailBlock("Capital and valuation", `<p><strong>Funding:</strong> ${sourceAnchor(company.funding, investorSource, "detail-source-link")}</p><p><strong>Latest public valuation:</strong> ${sourceAnchor(company.valuation, valuationSource, "detail-source-link")}</p>${multiple ? `<p><strong>Headline multiple:</strong> ${escapeHtml(multiple)} <span class="disclosure-note">(rough and unnormalized)</span></p>` : ""}<p><strong>${escapeHtml(capitalLabel(company))}:</strong> ${sourceAnchor(company.investors, investorSource, "detail-source-link")}</p>`, "wide")}
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
