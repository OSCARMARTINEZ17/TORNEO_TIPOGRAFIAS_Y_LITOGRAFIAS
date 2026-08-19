/* =========================================================
   TORNEO GREMIAL — script.js
   Menú móvil, countdown al silbatazo inicial y validación
   simple del formulario de inscripción.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initCountdown();
  initStandings();
  initMatchTabs();
  initTeams().then((teamNames) => {
    initMatches(teamNames);
  });
});

/* ---------- Tabla de posiciones en vivo (Google Sheets) ---------- */
// URL del rango ya ordenado (hoja "Posiciones", columnas N:W) de tu Google Sheet.
// Si cambias de spreadsheet o mueves la tabla de columna, actualiza esta URL.
const SHEET_ID = "16SPJe7pkLcJurVrMVFH2VMsg0gAscddnH8CGonias_g";
const STANDINGS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Posiciones&range=N1:W18`;

// Pestaña "Equipos": columnas esperadas A Equipo | B Escudo (URL de imagen).
// Pestaña "Jugadores": columnas esperadas A Equipo | B Jugador | C Foto (URL).
// Ambas deben vivir en el mismo spreadsheet (SHEET_ID) y estar compartidas
// como "cualquiera con el enlace puede ver".
const TEAMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Equipos`;
const PLAYERS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Jugadores`;

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

/* ---------- Equipos (escudo, nombre y plantilla) ---------- */
async function initTeams() {
  const grid = document.getElementById("teams-grid");
  const meta = document.getElementById("teams-meta");
  if (!grid) return [];
  return loadTeams(grid, meta);
}

async function loadTeams(grid, meta) {
  try {
    const [teamsRes, playersRes] = await Promise.all([
      fetch(TEAMS_CSV_URL, { cache: "no-store" }),
      fetch(PLAYERS_CSV_URL, { cache: "no-store" }),
    ]);
    if (!teamsRes.ok) throw new Error("No se pudo leer la hoja de equipos.");

    const teamsCsv = await teamsRes.text();
    const teamRows = parseCsv(teamsCsv)
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .slice(1); // encabezado: Equipo, Escudo

    let playerRows = [];
    if (playersRes.ok) {
      const playersCsv = await playersRes.text();
      playerRows = parseCsv(playersCsv)
        .filter((row) => row.some((cell) => cell.trim() !== ""))
        .slice(1); // encabezado: Equipo, Jugador, Foto
    }

    if (teamRows.length === 0) {
      grid.innerHTML =
        '<p class="standings-loading">Todavía no hay equipos registrados.</p>';
      if (meta) meta.textContent = "";
      return [];
    }

    grid.innerHTML = teamRows
      .map((row) => teamCardToHtml(row, playerRows))
      .join("");
    bindTeamToggles(grid);

    if (meta) {
      meta.textContent = `${teamRows.length} equipo${teamRows.length === 1 ? "" : "s"} inscrito${teamRows.length === 1 ? "" : "s"}`;
    }

    return teamRows.map((row) => (row[0] || "").trim()).filter(Boolean);
  } catch (err) {
    grid.innerHTML =
      '<p class="standings-error">No se pudo cargar la lista de equipos. Revisa que la hoja "Equipos" esté compartida como público.</p>';
    return [];
  }
}

function teamCardToHtml(row, playerRows) {
  const [equipo, escudo] = row;
  const nombre = (equipo || "Equipo por definir").trim();
  const players = playerRows.filter(
    (p) => (p[0] || "").trim().toLowerCase() === nombre.toLowerCase(),
  );

  const escudoHtml = escudo && escudo.trim()
    ? `<img src="${escudo.trim()}" alt="Escudo de ${nombre}" class="team-crest" loading="lazy" />`
    : `<span class="team-crest team-crest--placeholder" aria-hidden="true">⚽</span>`;

  const playersHtml = players.length
    ? players
        .map((p) => {
          const jugador = (p[1] || "Jugador por definir").trim();
          const foto = (p[2] || "").trim();
          const fotoHtml = foto
            ? `<img src="${foto}" alt="${jugador}" class="player-photo" loading="lazy" />`
            : `<span class="player-photo player-photo--placeholder" aria-hidden="true">🧑</span>`;
          return `<li class="player-card">${fotoHtml}<span class="player-name">${jugador}</span></li>`;
        })
        .join("")
    : '<li class="player-card player-card--empty">Plantilla por confirmar</li>';

  return `
    <article class="team-card">
      <button class="team-card-head" type="button" aria-expanded="false">
        ${escudoHtml}
        <span class="team-name">${nombre}</span>
        <span class="team-toggle-icon" aria-hidden="true">+</span>
      </button>
      <ul class="player-grid">${playersHtml}</ul>
    </article>`;
}

function bindTeamToggles(grid) {
  grid.querySelectorAll(".team-card-head").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".team-card");
      const isOpen = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
    });
  });
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

/* ---------- Pestañas Próximos / Jugados ---------- */
function initMatchTabs() {
  const tabs = document.querySelectorAll(".matches-tab");
  const panels = {
    proximos: document.getElementById("match-list-proximos"),
    jugados: document.getElementById("match-list-jugados"),
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      const target = tab.dataset.tab;
      Object.entries(panels).forEach(([key, panel]) => {
        if (panel) panel.classList.toggle("is-active", key === target);
      });
    });
  });
}

// teamNames: lista de equipos ya cargados desde la hoja "Equipos". Se usa
// como respaldo para generar automáticamente el fixture de próximas fechas
// (todos contra todos) cuando la hoja "Partidos" todavía no tiene filas
// futuras cargadas.
function initMatches(teamNames) {
  const proximosList = document.getElementById("match-list-proximos");
  const jugadosList = document.getElementById("match-list-jugados");
  const meta = document.getElementById("matches-meta");
  if (!proximosList && !jugadosList) return;

  loadMatches(proximosList, jugadosList, meta, teamNames);
  setInterval(
    () => loadMatches(proximosList, jugadosList, meta, teamNames),
    2 * 60 * 1000,
  );
}

async function loadMatches(proximosList, jugadosList, meta, teamNames) {
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

    const jugadosRows = dataRows.filter(isJugado);
    let proximosRows = dataRows.filter((row) => !isJugado(row));
    let autoGenerado = false;

    // Si la hoja todavía no trae próximas fechas, generamos un fixture
    // "todos contra todos" a partir de los equipos inscritos, arrancando
    // el próximo sábado. Son fechas tentativas hasta que las confirmes en
    // la hoja de cálculo.
    if (proximosRows.length === 0 && teamNames && teamNames.length >= 2) {
      proximosRows = generateRoundRobin(teamNames, nextSaturday());
      autoGenerado = true;
    }

    if (jugadosList) {
      jugadosList.innerHTML = jugadosRows.length
        ? jugadosRows.map((row) => matchToHtml(row, false)).join("")
        : '<p class="standings-loading">Todavía no se ha jugado ningún partido.</p>';
    }
    if (proximosList) {
      proximosList.innerHTML = proximosRows.length
        ? proximosRows.map((row) => matchToHtml(row, autoGenerado)).join("")
        : '<p class="standings-loading">Todavía no hay partidos programados.</p>';
    }

    if (meta) {
      const now = new Date();
      const nota = autoGenerado
        ? " · Próximas fechas tentativas, generadas automáticamente a partir de los equipos inscritos"
        : "";
      meta.textContent = `Última actualización: ${now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}${nota}`;
    }
  } catch (err) {
    const msg =
      '<p class="standings-error">No se pudo cargar el calendario. Revisa que la hoja de Google Sheets esté compartida como público.</p>';
    if (jugadosList) jugadosList.innerHTML = msg;
    if (proximosList) proximosList.innerHTML = msg;
  }
}

function isJugado(row) {
  const [, , , golesLocal, , golesVisitante] = row;
  return (
    golesLocal !== undefined &&
    golesLocal.trim() !== "" &&
    golesVisitante !== undefined &&
    golesVisitante.trim() !== ""
  );
}

function matchToHtml(row, autoGenerado) {
  const [fecha, jornada, local, golesLocal, visitante, golesVisitante, hora] =
    row;

  const jugado = isJugado(row);

  const fechaFormateada = formatMatchDate(fecha);
  const statusHtml = jugado
    ? `<span class="match-status match-status--jugado">Jugado</span>`
    : `<span class="match-status match-status--proximo">Próximo</span>`;
  const scoreHtml = jugado
    ? `<span class="match-score">${golesLocal} – ${golesVisitante}</span>`
    : `<span class="match-score">vs</span>`;
  const tentativaHtml =
    autoGenerado && !jugado
      ? `<span class="match-tentativa">Fecha tentativa</span>`
      : "";

  return `
    <div class="match-row ${jugado ? "" : "match-row--proximo"}">
      <div class="match-when">
        <span class="match-date">${fechaFormateada}</span>
        ${hora ? `<span class="match-hour">${hora}</span>` : ""}
        <span class="match-jornada">Jornada ${jornada || "-"}</span>
        ${tentativaHtml}
      </div>
      <div class="match-teams">
        <span class="match-team match-team--local">${local || "Por definir"}</span>
        ${scoreHtml}
        <span class="match-team match-team--visitante">${visitante || "Por definir"}</span>
      </div>
      ${statusHtml}
    </div>`;
}

// Fixture "todos contra todos" por el método del círculo: cada equipo
// mantiene su lugar salvo el primero, y el resto rota una posición por
// jornada. Si el número de equipos es impar, se agrega un "descanso".
function generateRoundRobin(teamNames, startDateISO) {
  let teams = teamNames.filter(Boolean);
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams = [...teams, null];

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const schedule = [];
  let current = teams.slice();
  const start = new Date(`${startDateISO}T00:00:00`);

  for (let round = 0; round < rounds; round++) {
    const roundDate = new Date(start);
    roundDate.setDate(start.getDate() + round * 7); // una jornada por semana
    const fecha = roundDate.toISOString().slice(0, 10);

    for (let i = 0; i < half; i++) {
      const local = current[i];
      const visitante = current[n - 1 - i];
      if (local && visitante) {
        schedule.push([fecha, String(round + 1), local, "", visitante, "", ""]);
      }
    }

    const fixed = current[0];
    const rest = current.slice(1);
    rest.unshift(rest.pop());
    current = [fixed, ...rest];
  }

  return schedule;
}

function nextSaturday() {
  const d = new Date();
  const day = d.getDay(); // 0 domingo ... 6 sábado
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
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