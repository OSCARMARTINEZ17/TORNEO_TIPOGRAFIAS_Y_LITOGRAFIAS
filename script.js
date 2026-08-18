/* =========================================================
   TORNEO GREMIAL — script.js
   Menú móvil, countdown al silbatazo inicial y validación
   simple del formulario de inscripción.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initCountdown();
  initStandings();
  initMatches();
});

/* ---------- Tabla de posiciones en vivo (Google Sheets) ---------- */
// URL del rango ya ordenado (hoja "Posiciones", columnas N:W) de tu Google Sheet.
// Si cambias de spreadsheet o mueves la tabla de columna, actualiza esta URL.
const SHEET_ID = "16SPJe7pkLcJurVrMVFH2VMsg0gAscddnH8CGonias_g";
const STANDINGS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Posiciones&range=N1:W18`;

function initStandings() {
  const body = document.getElementById("standings-body");
  const meta = document.getElementById("standings-meta");
  if (!body) return;

  loadStandings(body, meta);
  // Refresca sola cada 2 minutos mientras la página quede abierta.
  setInterval(() => loadStandings(body, meta), 2 * 60 * 1000);
}

async function loadStandings(body, meta) {
  try {
    const response = await fetch(STANDINGS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer la hoja de cálculo.");

    const csvText = await response.text();
    const rows = parseCsv(csvText).filter((row) =>
      row.some((cell) => cell.trim() !== ""),
    );

    // La primera fila es el encabezado (Pos, Equipo, PJ...); la ignoramos.
    const dataRows = rows.slice(1);

    if (dataRows.length === 0) {
      body.innerHTML =
        '<tr><td colspan="10" class="standings-loading">Todavía no hay partidos registrados.</td></tr>';
    } else {
      body.innerHTML = dataRows.map(rowToHtml).join("");
    }

    if (meta) {
      const now = new Date();
      meta.textContent = `Última actualización: ${now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
    }
  } catch (err) {
    body.innerHTML =
      '<tr><td colspan="10" class="standings-error">No se pudo cargar la tabla. Revisa que la hoja de Google Sheets esté compartida como público.</td></tr>';
  }
}

function rowToHtml(row) {
  const [pos, equipo, pj, pg, pe, pp, gf, gc, dg, pts] = row;
  return `
    <tr>
      <td class="al">${pos}</td>
      <td class="al">${equipo}</td>
      <td>${pj}</td>
      <td>${pg}</td>
      <td>${pe}</td>
      <td>${pp}</td>
      <td>${gf}</td>
      <td>${gc}</td>
      <td>${dg}</td>
      <td class="pts">${pts}</td>
    </tr>`;
}

// Parser de CSV sencillo: soporta campos entre comillas (Google los usa si
// un valor trae comas). Suficiente para una tabla como esta, sin depender
// de ninguna librería externa.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---------- Menú móvil ---------- */
function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---------- Countdown al inicio del torneo ---------- */
function initCountdown() {
  const el = document.getElementById("countdown");
  const statusEl = document.getElementById("countdown-status");
  if (!el) return;

  const target = new Date(el.dataset.target).getTime();
  const daysEl = document.getElementById("cd-days");
  const hoursEl = document.getElementById("cd-hours");
  const minsEl = document.getElementById("cd-mins");
  const secsEl = document.getElementById("cd-secs");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function render() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      // El torneo ya inició: mostramos ceros y cambiamos el mensaje.
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minsEl.textContent = "00";
      secsEl.textContent = "00";
      if (statusEl) {
        statusEl.innerHTML =
          '<span class="live-dot" aria-hidden="true"></span> ¡EL TORNEO YA ARRANCÓ!';
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    daysEl.textContent = pad(days);
    hoursEl.textContent = pad(hours);
    minsEl.textContent = pad(mins);
    secsEl.textContent = pad(secs);
  }

  render();
  setInterval(render, 1000);
}

/* ---------- Partidos: resultados y próximas fechas ---------- */
// Misma hoja de cálculo, pestaña "Partidos". Columnas esperadas:
// A Fecha | B Jornada | C Equipo Local | D Goles Local |
// E Equipo Visitante | F Goles Visitante | G Hora
// Si Goles Local y Goles Visitante están vacíos, el partido se muestra
// como "Próximo" con la hora en vez del marcador.
const MATCHES_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Partidos`;

function initMatches() {
  const list = document.getElementById("match-list");
  const meta = document.getElementById("matches-meta");
  if (!list) return;

  loadMatches(list, meta);
  setInterval(() => loadMatches(list, meta), 2 * 60 * 1000);
}

async function loadMatches(list, meta) {
  try {
    const response = await fetch(MATCHES_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer la hoja de cálculo.");

    const csvText = await response.text();
    const rows = parseCsv(csvText).filter((row) =>
      row.some((cell) => cell.trim() !== ""),
    );

    // La primera fila es el encabezado (Fecha, Jornada...); la ignoramos.
    const dataRows = rows
      .slice(1)
      .filter((row) => row[0] && row[0].trim() !== "");

    if (dataRows.length === 0) {
      list.innerHTML =
        '<p class="standings-loading">Todavía no hay partidos programados.</p>';
    } else {
      list.innerHTML = dataRows.map(matchToHtml).join("");
    }

    if (meta) {
      const now = new Date();
      meta.textContent = `Última actualización: ${now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
    }
  } catch (err) {
    list.innerHTML =
      '<p class="standings-error">No se pudo cargar el calendario. Revisa que la hoja de Google Sheets esté compartida como público.</p>';
  }
}

function matchToHtml(row) {
  const [fecha, jornada, local, golesLocal, visitante, golesVisitante, hora] =
    row;

  const jugado =
    golesLocal !== undefined &&
    golesLocal.trim() !== "" &&
    golesVisitante !== undefined &&
    golesVisitante.trim() !== "";

  const fechaFormateada = formatMatchDate(fecha);
  const statusHtml = jugado
    ? `<span class="match-status match-status--jugado">Jugado</span>`
    : `<span class="match-status match-status--proximo">Próximo</span>`;
  const scoreHtml = jugado
    ? `<span class="match-score">${golesLocal} – ${golesVisitante}</span>`
    : `<span class="match-score">vs</span>`;

  return `
    <div class="match-row ${jugado ? "" : "match-row--proximo"}">
      <div class="match-when">
        <span class="match-date">${fechaFormateada}</span>
        ${hora ? `<span class="match-hour">${hora}</span>` : ""}
        <span class="match-jornada">Jornada ${jornada || "-"}</span>
      </div>
      <div class="match-teams">
        <span class="match-team match-team--local">${local || "Por definir"}</span>
        ${scoreHtml}
        <span class="match-team match-team--visitante">${visitante || "Por definir"}</span>
      </div>
      ${statusHtml}
    </div>`;
}

function formatMatchDate(fecha) {
  if (!fecha) return "Fecha por definir";
  const parsed = new Date(`${fecha.trim()}T00:00:00`);
  if (isNaN(parsed.getTime())) return fecha;
  return parsed.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ---------- Menú móvil ---------- */