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

If we change what a plan costs, we tell you before your next payment, and the change applies from the payment after that. We do not re-price you mid-period.

If a price rise is not acceptable to you, you can cancel before it takes effect and pay nothing more. The [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}) sets out how.
{{/clause}}

{{#clause id=PRICING.WHAT_YOU_PAY_WITH}}
## How you pay

The [Terms and Conditions]({{ facts.routes.terms }}) set out who takes the payment and how.

Whatever the route, we do not store your full card number, and this page is the only place where what you owe is stated.
{{/clause}}

{{#clause id=PRICING.CONTACT}}
## Questions about a charge

Write to {{ facts.support.email }} or call {{ facts.support.phone }}.

We reply within {{ window.ack_hours }} hours.
{{/clause}}
