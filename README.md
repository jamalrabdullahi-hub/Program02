# FTL-Pay

*Faster-than-light payments.* Install it like a widget straight from this GitHub repo:
one `<div>`, one `<script>` tag pointed at this repo's own files. No npm install, no
build step, nothing to download and vendor into your project.

![Pay with FTL-Pay](assets/button-preview.png)

## Get it from GitHub — literally

This repo is public, which means [jsDelivr](https://www.jsdelivr.com/) CDN-serves its
files for free with no publish step on our end:

```
https://cdn.jsdelivr.net/gh/jamalrabdullahi-hub/Program02@v0.1.0/ftlpay.js
```

Pin a released tag (`@v0.1.0`, above) rather than `@main` in anything you'd call
production — `@main` tracks this branch and can change under you; a tag never does.
Check the [tags](../../tags) for the latest.

## The whole integration

**On your server**, with your secret key (never in the browser), when you already know
the order total:

```bash
curl -X POST https://YOUR-FTLPAY-ORIGIN/v1/payment_intents \
  -H "authorization: Bearer sk_test_..." \
  -H "content-type: application/json" \
  -d '{"amount":5100,"currency":"USD","merchant_reference":"ORDER-84721"}'
```

`amount` is integer minor units — `5100` is $51.00. The response has a `client_secret`.
This is the one step that can't be skipped — it's what stops a customer setting their own
price — but it's the only server-side code this integration needs.

**On your page**, render that `client_secret` into these attributes the same way you
already render the order total into the page:

```html
<div data-ftlpay-button
     data-publishable-key="pk_test_..."
     data-client-secret="<from your server, above>"
     data-return-url="https://yoursite.example/thank-you"></div>
<script src="https://cdn.jsdelivr.net/gh/jamalrabdullahi-hub/Program02@v0.1.0/ftlpay.js"
        data-origin="https://YOUR-FTLPAY-ORIGIN"></script>
```

That's the whole thing. No JavaScript to write, no function call — the button finds its
own `data-ftlpay-button` div and mounts itself. `data-origin` on the script tag is what
tells it where *your* FTL-Pay backend actually lives, since the file itself is now
loaded from jsDelivr rather than from you — see [`ftlpay.js`](ftlpay.js)'s own comment
block for the self-hosted alternative (drop `data-origin`, it falls back to wherever the
script file was loaded from).

FTL-Pay renders the button itself: black, the wordmark, nothing for you to style.
Clicking it is a real top-level navigation to FTL-Pay's own hosted page, where the phone
number, provider selection, wallet verification, and payment instructions all happen.
Your page never touches a wallet number and never decides a payment succeeded.

Building the page with JavaScript instead of a server template — a single-page app, a
button that appears after a `fetch`? Call `FTLPay.mountButton('#selector', options)`
directly; it's the same button, the imperative way. `FTLPay.scanForButtons()` re-scans
the DOM for `data-ftlpay-button` elements if you inject markup after the page has already
loaded.

Two full working examples: [`examples/zero-js.html`](examples/zero-js.html) (the
attribute-only version above) and [`examples/minimal.html`](examples/minimal.html) (the
JS-driven version, for a single-page app creating the order after load). The SDK itself
is [`ftlpay.js`](ftlpay.js) — read it, it's about 150 lines and does exactly what this
README says and nothing else.

## What your customers actually see

[`hosted-checkout/checkout.html`](hosted-checkout/checkout.html) is the real page — not a
mockup — that FTL-Pay serves at `/checkout` and that `mountButton`/`redirectToCheckout`
send your customer to. You don't host it or deploy it; it's here so you can read exactly
what your customers experience before you send anyone to it: the phone number field, the
provider picker, the verify-or-pay decision, the payment-window countdown, the confirm
step before real money moves. Nothing in it talks to anything but FTL-Pay's own API —
your site is never in the loop while it's on screen.

## The three things you must get right

**1. Create the payment intent on your server, never in the browser.**
The secret key can create real payment obligations. If it's ever in frontend code,
anyone can create charges against your account. Only `publishableKey` and `clientSecret`
belong in the browser — see the key comparison below.

**2. Fulfil the order on the webhook, not on anything the browser tells you.**
[`verify-signature.js`](verify-signature.js) in this repo is a real, complete
implementation — copy it in:

```js
const { verifySignature } = require('./verify-signature');

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.header('safeverify-signature'); // t=<unix seconds>,v1=<hex hmac>
  if (!verifySignature(YOUR_SIGNING_SECRET, sig, req.body.toString('utf8'))) {
    return res.sendStatus(400);
  }
  const event = JSON.parse(req.body);
  if (event.event === 'payment.completed') {
    // fulfil ORDER event.merchant_reference here
  }
  res.sendStatus(200);
});
```

It checks an HMAC-SHA256 over `timestamp.body` and rejects anything outside a freshness
window, so a captured delivery can't be replayed later to trigger a second fulfilment.
The customer can close the tab, lose signal, or never come back from checkout at all —
the webhook is the only thing that should ever mark an order fulfilled.

**3. `returnUrl` is for the customer's screen, not for your fulfilment logic.**
FTL-Pay redirects the customer back to it after a moment, with
`?ftlpay_status=completed&payment_intent=pi_...` (or `cancelled`) on the query string.
Use it to show a "thanks!" message. Don't use it to decide whether to ship the order —
that's what the webhook is for.

## Keys, at a glance

| Key | Lives where | Can do |
|---|---|---|
| `sk_...` secret key | your server only | create payment intents, register webhooks |
| `pk_...` publishable key | your page's source, openly | identifies your account, nothing else |
| `client_secret` | passed from your server to your page, per order | lets the browser act on **that one order**, nothing else |
| webhook signing secret | your server only | lets you verify a webhook actually came from FTL-Pay |

None of these are useful stolen in isolation the way a full API key pair would be: a
leaked publishable key + client secret lets someone see one order's state, not create
charges or read anyone else's data.

## FAQ

**Can I style the button myself?** Not the provided one — that's the point, it's a
finished component. If you want your own button, call `FTLPay.redirectToCheckout(options)`
(same options, same behavior) from whatever element you build.

**Does this work on old/feature phones?** Yes — the checkout itself is a normal web page,
but the payment step is a USSD dial string the customer's handset already supports,
verified/paid the same way regardless of what device loaded your site.

**What if the customer already verified a wallet somewhere else?** They skip straight to
payment — no second verification. That's the whole point of FTL-Pay: verify once, use it
at every FTL-Pay merchant.

---

This repo is intentionally small: the client-side integration surface and the actual
checkout page your customers see, nothing else. It doesn't include the backend, the
admin console, or anything else you'd need to run FTL-Pay yourself — talk to us about
that.
