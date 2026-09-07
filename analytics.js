/* ===========================================================================
 * REEBLINK — EVENT TRACKING
 *
 * One file for the whole site. It attaches delegated listeners at the
 * document level and touches nothing that already exists: no markup was
 * changed, no existing script was edited. If this file is deleted, the site
 * behaves exactly as it did before.
 *
 * Page views, referrers and UTM parameters are recorded by the Umami script
 * itself. This file adds only the events Umami cannot infer.
 *
 * Loaded after the Umami tag; both use `defer`, so execution order is
 * guaranteed. Every call is guarded — if the analytics script is blocked by
 * an ad blocker, nothing here throws.
 * ======================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
   * 0. OWNER OPT-OUT — confirmation only
   * The flag itself is set by the one-line script placed above the Umami tag,
   * which has to run before the tracker does. This only tells the person
   * standing in front of the screen that it worked — there is no console on
   * a phone, so without a visible answer the switch is unverifiable.
   * -------------------------------------------------------------------- */
  (function () {
    if (location.search.indexOf("optout") === -1 &&
        location.search.indexOf("optin") === -1) return;

    var off;
    try { off = localStorage.getItem("umami.disabled") === "1"; }
    catch (e) { off = null; }

    var bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;" +
      "max-width:min(520px,calc(100vw - 32px));box-sizing:border-box;" +
      "padding:14px 20px;border:1px solid #26262B;border-radius:8px;" +
      "background:#111114;color:#C9C7C0;text-align:center;" +
      "font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
    bar.textContent =
      off === null
        ? "Не удалось сохранить настройку — браузер блокирует хранилище сайта."
        : off
          ? "Этот браузер больше не учитывается в статистике."
          : "Этот браузер снова учитывается в статистике.";

    var show = function () { document.body.appendChild(bar); };
    if (document.body) show();
    else document.addEventListener("DOMContentLoaded", show);
  })();

  function track(name, data) {
    try {
      if (window.umami && typeof window.umami.track === "function") {
        window.umami.track(name, data);
      }
    } catch (e) {
      /* analytics must never break the page */
    }
  }

  function text(el, max) {
    return (el && el.textContent ? el.textContent : "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 80);
  }

  /* -----------------------------------------------------------------------
   * 1. CLICKS
   * One delegated listener. Each rule matches an element that already
   * exists on the page; nothing is added to the HTML.
   * -------------------------------------------------------------------- */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      /* -- home page: the seven-window narrative ------------------------
       * The "next window" buttons on index.html. Tells us at which window
       * the story loses the reader. */
      var jump = t.closest('a[href^="#w"], a[href="#cta"]');
      if (jump) {
        track("home-window", { to: jump.getAttribute("href").slice(1) });
        return;
      }

      /* -- the funnel ---------------------------------------------------- */
      var link = t.closest("a[href]");
      if (link) {
        var href = link.getAttribute("href") || "";
        var here = location.pathname.split("/").pop() || "index.html";

        if (href.indexOf("participants.html") === 0) {
          track("cta-participants", { from: here });
          return;
        }
        if (href.indexOf("checkout.html") === 0) {
          track("cta-checkout", { from: here });
          return;
        }
        if (href.indexOf("faq.html") === 0) {
          track("open-faq", { from: here });
          return;
        }
        if (href.indexOf("mailto:") === 0) {
          track("email-click", { from: here });
          return;
        }
        /* investor deck — external link */
        if (/^https?:/.test(href) && here === "investors.html") {
          track("investor-deck-open");
          return;
        }
      }

      /* -- named controls ------------------------------------------------ */
      var btn = t.closest("button[id]");
      if (!btn) return;

      switch (btn.id) {
        case "open-ask":
          track("faq-ask-open");
          break;
        case "btn-ask":
          track("faq-ask-step-question");
          break;
        case "btn-sub":
          track("faq-subscribe");
          break;
        case "btn-send-q":
          track("faq-question-sent");
          break;
        case "copy-email":
          track("investor-email-copied");
          break;
      }
    },
    true
  );

  /* -----------------------------------------------------------------------
   * 2. FAQ ACCORDION
   * Which questions people actually open — i.e. what they are unsure about.
   * `toggle` does not bubble, so the listener runs in the capture phase.
   * -------------------------------------------------------------------- */
  document.addEventListener(
    "toggle",
    function (e) {
      var d = e.target;
      if (!d || d.tagName !== "DETAILS" || !d.open) return;
      var s = d.querySelector("summary");
      if (s) {
        /* drop the "+/-" accordion marker so the label reads as the question */
        var clone = s.cloneNode(true);
        var mark = clone.querySelector(".acc-mark");
        if (mark) mark.remove();
        track("faq-opened", { q: text(clone, 90) });
      }
    },
    true
  );

  /* -----------------------------------------------------------------------
   * 3. CHECKOUT — TERMS ACCEPTED
   * The last step we can measure on our own side. What happens after this
   * point runs inside the NOWPayments iframe, which is a different origin
   * and therefore invisible to us. A completed payment is reported by the
   * Cloudflare Worker to Telegram, not here.
   * -------------------------------------------------------------------- */
  document.addEventListener(
    "change",
    function (e) {
      if (!e.target || e.target.id !== "accept-terms") return;
      track(e.target.checked ? "checkout-terms-accepted" : "checkout-terms-unchecked");
    },
    true
  );

  /* -----------------------------------------------------------------------
   * 4. READING DEPTH
   * Fires once per page, at 75% scroll depth. Separates "landed and left"
   * from "actually read it" — the difference that matters on pages whose
   * only job is to be read.
   * -------------------------------------------------------------------- */
  var deepFired = false;
  window.addEventListener(
    "scroll",
    function () {
      if (deepFired) return;
      var doc = document.documentElement;
      var seen = window.scrollY + window.innerHeight;
      var total = Math.max(doc.scrollHeight, document.body.scrollHeight);
      if (total > 0 && seen / total >= 0.75) {
        deepFired = true;
        track("read-75");
      }
    },
    { passive: true }
  );
})();
