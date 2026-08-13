{{#clause id=PRICING.PLANS}}
## What it costs

{{ table.pricing }}

Every figure above is the whole amount you pay. There is no setup fee, no per-seat surcharge added at checkout, and no separate charge for support.
{{/clause}}

{{#clause id=PRICING.GSTIN when=derived.invoice_kind=gst}}
## Tax

**The figures above include GST.** You are not charged anything on top of them.

We are registered for GST. Our GSTIN is **{{ facts.gstin }}** and it appears on every invoice we issue. Ask at {{ facts.support.email }} if you need an invoice re-issued with your own GSTIN on it.

What the tax treatment means for your own filings is a question for your accountant, not for this page.
{{/clause}}

{{#clause id=PRICING.NO_GST when=derived.invoice_kind=no-gst}}
## Tax

**The figures above are the whole amount, and no GST is charged on them.** We are not registered for GST, so our invoices carry no GSTIN and no tax component.

If our registration status changes, the figures on this page will change with it, and we will say so before we bill you at a new amount.

What that means for your own filings is a question for your accountant, not for this page.
{{/clause}}

{{#clause id=PRICING.CHANGES}}
## When prices change

**If we raise the price of a plan you are on, we tell you at least {{ facts.commitments.price_notice_days }} days before your next renewal, and you may cancel at the old price until then.** The new price applies from that renewal. We never change the price of a period you have already paid for.

That is the same commitment, in the same words, as *Fees and payment* in the [Terms and Conditions]({{ facts.routes.terms }}) — deliberately, because this page and that one were saying different things. This page used to promise notice "before your next payment" with the change applying "from the payment after that", which is a different rule worth a different amount of money, and it is the page you read before you buy.

If a price rise is not acceptable to you, you can cancel before it takes effect and pay nothing more. The [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}) sets out how.
{{/clause}}

{{#clause id=PRICING.WHAT_YOU_PAY_WITH when=payment_model=gateway}}
## How you pay

You can pay by card, UPI, net banking or wallet. Payments are processed for us by {{ label.payment_provider }} over an encrypted connection; we never see or store your full card number. We are the merchant, so the charge on your statement is ours.

**These plans renew automatically.** Paying sets up a recurring mandate: the same amount is charged on the same day each period until you stop it. We email you the amount and the date at least {{ facts.commitments.renewal_notice_days }} days before every charge, and you can turn renewal off at any time — see the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}), which also sets out your chargeback position.

If a payment fails we email you and keep your access for {{ facts.commitments.payment_failure_grace_days }} days before suspending it.

There are no charges anywhere on this site that are not on this page. The same total is shown again before you confirm any payment, and on every invoice.
{{/clause}}

{{#clause id=PRICING.WHAT_YOU_PAY_WITH.MOR when=payment_model=mor}}
## How you pay

Your payment is taken by {{ label.payment_provider }}, which sells the subscription to you as the merchant of record and issues your receipt — so the name on your statement is theirs, not ours. We never see or store your full card number. The [Terms and Conditions]({{ facts.routes.terms }}) set out what that split means for you.

**These plans renew automatically.** We email you the amount and the date at least {{ facts.commitments.renewal_notice_days }} days before every charge, and you can turn renewal off at any time — see the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}).

There are no charges anywhere on this site that are not on this page. The same total is shown again before you confirm any payment, and on every invoice.
{{/clause}}

{{#clause id=PRICING.WHAT_YOU_PAY_WITH.OFFLINE when=payment_model=none}}
## How you pay

**There is no checkout on this site and no card payment page.** We invoice you directly and you pay by bank transfer, or by another method we agree with you in writing. Write to {{ facts.support.email }} with the plan you want and we will send you an invoice; access starts once we have confirmed the transfer has arrived.

**We will never ask you for card details, by any route.** If anything claiming to be us asks you for a card number, it is not us.

**Nothing is charged automatically**, because we hold no payment instrument of yours. Each period is a fresh invoice you choose to pay, and the arrangement continues until you tell us to stop — email {{ facts.support.email }} before the next invoice date.

If an invoice is late we send a reminder and your access continues for {{ facts.commitments.payment_failure_grace_days }} days before we suspend it. Your data stays intact and exportable, and we restore everything the moment the transfer lands.

There are no charges anywhere on this site that are not on this page, and the same figures appear on every invoice.
{{/clause}}

{{#clause id=PRICING.CONTACT}}
## Questions about a charge

Write to {{ facts.support.email }} or call {{ facts.support.phone }}.

We reply within {{ window.ack_hours }} hours.
{{/clause}}
