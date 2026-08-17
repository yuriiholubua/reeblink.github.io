// PRE-ORDER COUNTER — Level 1 (manual).
// Edit RESERVED after each confirmed pre-order; every page updates automatically.
// Level 2 (live): replace the constant with a fetch from the payment provider / backend.
var RESERVED = 0;

document.querySelectorAll("[data-counter]").forEach(function (el) {
  el.textContent = String(RESERVED);
});
