/**
 * checkout-currency-selector.js
 *
 * Populates the currency <select> on the checkout start page by fetching
 * the store-scoped currency list from /api/v1/store/{storeCode}/currencies.
 *
 * storeCode is read exclusively from a server-rendered data attribute
 * (NFR-03 / FR-05) — never from a client-supplied query parameter.
 *
 * Accessibility: the <select> has an associated <label> and aria-label
 * attribute (NFR-07 / AC-01).
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var ctx = document.getElementById('store-context');

    if (!ctx) {
      // Guard: store-context element must be present; nothing to do otherwise.
      console.warn('Currency selector: #store-context element not found.');
      return;
    }

    // storeCode is injected server-side via th:data-store-code (FR-05 / NFR-03).
    var storeCode = ctx.dataset.storeCode;

    // currencyFallbackApplied is set server-side when the session currency is
    // not in the store's enabled list (FR-03 / AC-04).
    var fallbackApplied = ctx.dataset.fallbackApplied === 'true';

    // The fallback currency code (store base currency) rendered server-side.
    var fallbackCurrency = ctx.dataset.fallbackCurrency || null;

    if (!storeCode) {
      console.warn('Currency selector: storeCode data attribute is empty.');
      return;
    }

    // Fetch the store-scoped currency list (AC-02 / FR-01).
    // No synchronous external rate calls are made here (NFR-01).
    fetch('/api/v1/store/' + encodeURIComponent(storeCode) + '/currencies')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Currency API responded with status ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        var currencies = (data && Array.isArray(data.currencies)) ? data.currencies : [];

        var select = document.getElementById('currency-selector');
        if (!select) {
          console.warn('Currency selector: #currency-selector element not found.');
          return;
        }

        // Determine which currency should be pre-selected (AC-04 / FR-02).
        // Priority: fallback currency (when fallback applied) > session currency > isDefault entry.
        var activeCurrency = fallbackApplied
          ? fallbackCurrency
          : (getCookieOrSessionCurrency() || getDefaultCurrency(currencies));

        // Populate the <select> exclusively with currencies from the API (AC-02).
        currencies.forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.currencyCode;
          opt.text = c.currencyCode + ' (' + c.symbol + ')';
          if (c.currencyCode === activeCurrency) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });

        // Show the informational fallback banner when the server applied a
        // currency fallback (AC-04 / FR-03 / NFR-05).
        if (fallbackApplied) {
          var banner = document.getElementById('currency-fallback-banner');
          var nameSpan = document.getElementById('fallback-currency-name');
          if (banner && nameSpan) {
            nameSpan.textContent = fallbackCurrency || '';
            banner.style.display = '';
          }
        }
      })
      .catch(function (err) {
        // Log the error without throwing so the rest of the checkout page
        // continues to function (NFR-05 — non-blocking fallback).
        console.error('Currency selector error', err);
      });
  });

  /**
   * Returns the store's default currency code (isDefault === true).
   * Falls back to null if no default is marked.
   *
   * @param {Array} currencies - Array of currency objects from the API.
   * @returns {string|null}
   */
  function getDefaultCurrency(currencies) {
    var def = currencies.find(function (c) { return c.isDefault; });
    return def ? def.currencyCode : null;
  }

  /**
   * Returns the session/cookie currency code injected by the server via
   * data-session-currency on the #store-context element.
   * Returns null when not set, so the caller can fall back to the default.
   *
   * @returns {string|null}
   */
  function getCookieOrSessionCurrency() {
    var ctx = document.getElementById('store-context');
    return ctx ? (ctx.dataset.sessionCurrency || null) : null;
  }

}());
