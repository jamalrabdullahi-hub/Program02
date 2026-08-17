/**
 * FTL-Pay drop-in checkout.
 *
 *   <div id="ftlpay-button"></div>
 *   <script src="https://pay.ftlpay.example/ftlpay.js"></script>
 *   <script>
 *     FTLPay.mountButton('#ftlpay-button', {
 *       publishableKey: 'pk_test_...',
 *       clientSecret: '<from your server>',
 *       returnUrl: location.href  // optional — where the customer lands after paying
 *     });
 *   </script>
 *
 * That's the whole integration. Clicking the button takes the customer to FTL-Pay's own
 * hosted page — the phone number, provider selection, verification, and payment
 * instructions all happen there, on FTL-Pay's domain, never inside your page. Your site
 * never touches a wallet number and never decides a payment succeeded; it only ever sees
 * the customer again after FTL-Pay sends them back.
 *
 * If you want your own button instead of the provided one, call
 * `FTLPay.redirectToCheckout(options)` directly from whatever element you like.
 *
 * Fulfil on the webhook, not on the return — a customer can close the tab, lose signal,
 * or bookmark the return URL and revisit it later. `payment.completed` is the authority.
 */
(function () {
  'use strict';

  var ORIGIN = (function () {
    var current = document.currentScript && document.currentScript.src;
    if (!current) return window.location.origin;
    var url = new URL(current, window.location.href);
    return url.origin;
  })();

  var STYLE_ID = 'ftlpay-button-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.ftlpay-pay-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;',
      'background:#000;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:999px;',
      'padding:13px 22px;min-height:48px;font:600 15px/1 Arial,Calibri,sans-serif;cursor:pointer;',
      'transition:opacity .15s ease,transform .1s ease;box-shadow:0 1px 2px rgba(0,0,0,.15)}',
      '.ftlpay-pay-btn:hover{opacity:.85}',
      '.ftlpay-pay-btn:active{transform:scale(.98)}',
      '.ftlpay-pay-btn:disabled{opacity:.5;cursor:progress}',
      // ftlpay-wordmark-compact.png is pre-trimmed to the glowing mark itself, so it
      // needs no blend mode or fade mask to hide letterboxing the way the raw source
      // asset would — it's already flush black-on-black and reads clearly at this size.
      '.ftlpay-pay-btn img{height:16px;width:auto;display:block}',
    ].join('');
    document.head.appendChild(style);
  }

  function checkoutUrl(options) {
    var clientSecret = options.clientSecret || options.paymentIntent;
    if (!clientSecret) throw new Error('FTLPay requires a clientSecret');
    if (!options.publishableKey) throw new Error('FTLPay requires a publishableKey');

    var url = ORIGIN + '/checkout#client_secret=' + encodeURIComponent(clientSecret) +
      '&pk=' + encodeURIComponent(options.publishableKey);
    if (options.returnUrl) url += '&return_url=' + encodeURIComponent(options.returnUrl);
    return url;
  }

  /** Sends the customer's whole browser tab to the FTL-Pay hosted terminal. */
  function redirectToCheckout(options) {
    window.location.assign(checkoutUrl(options || {}));
  }

  /**
   * Renders FTL-Pay's own button — black, the wordmark, nothing to style. `target` is a
   * CSS selector or an element; its contents are replaced with the button.
   */
  function mountButton(target, options) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) throw new Error('FTLPay.mountButton: target not found: ' + target);
    injectStyles();

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ftlpay-pay-btn';
    button.setAttribute('aria-label', 'Pay with FTL-Pay');

    var label = document.createTextNode('Pay with ');
    var logo = document.createElement('img');
    logo.src = ORIGIN + '/assets/ftlpay-wordmark-compact.png';
    logo.alt = 'FTL-Pay';
    button.appendChild(label);
    button.appendChild(logo);

    button.addEventListener('click', function () {
      button.disabled = true;
      redirectToCheckout(options);
    });

    container.innerHTML = '';
    container.appendChild(button);
    return button;
  }

  var FTLPay = { redirectToCheckout: redirectToCheckout, mountButton: mountButton, origin: ORIGIN };
  window.FTLPay = FTLPay;
  // Back-compat for integrations written against the pre-rename global.
  window.SafeVerify = FTLPay;
})();
