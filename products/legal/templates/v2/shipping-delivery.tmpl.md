{{#clause id=DELIVERY.NATURE}}
## What we deliver, and how

**This is a software service. Nothing is shipped to you physically.** There is no parcel, no courier, no tracking number and no delivery address to give us.

We are publishing this page because a delivery policy is asked for regardless of whether what you buy arrives in a box, and because you are entitled to know when what you paid for becomes available.
{{/clause}}

{{#clause id=DELIVERY.WHEN when=derived.payment_is_automatic=yes}}
## When you get access

Access is granted electronically to the account you signed up with.

**Within {{ facts.delivery.access_within_hours }} hour(s) of a successful payment**, in the ordinary case immediately. You do not have to wait for anyone to approve anything by hand.

If access has not appeared after that, it is a fault and not a queue: write to {{ facts.support.email }}. We will restore access within one working day, or refund you for the period you could not use — and if it is not restored within that working day, the choice becomes yours rather than ours: say the word and we start the refund the same day.
{{/clause}}

{{#clause id=DELIVERY.WHEN.OFFLINE when=derived.payment_is_automatic=no}}
## When you get access

Access is granted electronically to the account you signed up with.

Because you pay us by bank transfer rather than through a payment gateway, **we cannot see your payment the moment you send it** — there is no automatic signal telling us it arrived. We check for incoming transfers every working day and **open access within one working day of the money reaching our account**.

A transfer sent late in the day, at a weekend or on a public holiday will not be seen until the next working day. If you need it sooner, email the transfer reference to {{ facts.support.email }} and we will open access on the reference without waiting for settlement.

If access has not appeared one working day after the money left your account, that is a fault: write to {{ facts.support.email }} and we will open access the same working day, or refund you in full.
{{/clause}}

{{#clause id=DELIVERY.WHERE}}
## Where it is delivered

To {{ facts.site_url }}, and to the email address on your account.

We do not impose geographic restrictions ourselves. Access may still be limited by our hosting or payment providers' own rules, or by sanctions law, and we cannot override those — so we are not promising you an absolute we do not control.

If your own network or jurisdiction blocks the service, we cannot deliver it to you. **That counts as a failure of delivery, not a change of mind**: tell us and we refund the part of the period you could not use, however long after the payment it is. The {{ facts.refund_window_days }}-day window on the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}) governs changes of mind — it does not limit this, and that page says so under *Failure of delivery*.
{{/clause}}

{{#clause id=DELIVERY.FAILURE}}
## If delivery fails

If we cannot give you access, you have not been delivered to, whatever the payment record says.

Write to {{ facts.support.email }}. We will either restore access or refund you in full, and we will not treat a failed delivery as a used period.
{{/clause}}

{{#clause id=DELIVERY.CONTACT}}
## Who to ask

{{ facts.support.email }}, or call {{ facts.support.phone }}.

We reply within {{ window.ack_hours }} hours.
{{/clause}}
