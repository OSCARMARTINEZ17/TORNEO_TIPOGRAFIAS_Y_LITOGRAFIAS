/* =========================================================
   TORNEO GREMIAL — script.js
   Menú móvil, countdown al silbatazo inicial y validación
   simple del formulario de inscripción.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initCountdown();
  initRegistrationForm();
});

/* ---------- Menú móvil ---------- */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Countdown al inicio del torneo ---------- */
function initCountdown() {
  const el = document.getElementById('countdown');
  const statusEl = document.getElementById('countdown-status');
  if (!el) return;

  const target = new Date(el.dataset.target).getTime();
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minsEl = document.getElementById('cd-mins');
  const secsEl = document.getElementById('cd-secs');

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      // El torneo ya inició: mostramos ceros y cambiamos el mensaje.
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      if (statusEl) {
        statusEl.innerHTML = '<span class="live-dot" aria-hidden="true"></span> ¡EL TORNEO YA ARRANCÓ!';
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

/* ---------- Validación del formulario de inscripción ---------- */
function initRegistrationForm() {
  const form = document.getElementById('registration-form');
  const feedback = document.getElementById('form-feedback');
  if (!form || !feedback) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      feedback.textContent = 'Revisa los campos marcados: falta información obligatoria.';
      feedback.className = 'form-feedback is-error';
      form.reportValidity();
      return;
    }

    const teamName = form.querySelector('#team-name').value.trim();

    // Aquí normalmente se enviarían los datos a un backend, a WhatsApp
    // Business API o a un servicio como Formspree / Google Sheets.
    // Este demo solo confirma visualmente el envío.
    feedback.textContent = `¡Listo! Recibimos la inscripción de "${teamName}". Óscar o Juanito te contactan por WhatsApp para confirmar el pago de los $300.000.`;
    feedback.className = 'form-feedback is-success';
    form.reset();
  });
}