{{#clause id=CONTACT.WHO}}
## Who you are contacting

**{{ facts.operator.legal_name }}**, trading as **{{ facts.operator.trade_name }}**.

{{ facts.geographic_address }}

That is a real address, not a mailbox service, and post sent to it reaches us.
{{/clause}}

{{#clause id=CONTACT.HOW}}
## How to reach us

- **Email:** {{ facts.support.email }}
- **Phone:** {{ facts.support.phone }}

Email is the fastest route and the one we answer first. **We reply within {{ window.ack_hours }} hours.**

There is no contact form on this site that hides where your message goes. The address above is the address a person reads.
{{/clause}}

{{#clause id=CONTACT.GRIEVANCE}}
## If it is a complaint rather than a question

Our grievance officer is **{{ facts.grievance.name }}**.

- **Email:** {{ facts.grievance.email }}
- **Post:** {{ facts.grievance.address }}

Complaints are acknowledged within {{ window.ack_hours }} hours and resolved within {{ window.resolve_days }} days. That route covers billing complaints as well as data ones, and it is set out in full in the [Privacy Policy]({{ facts.routes.privacy }}).

You do not have to go through support first. If you want to start with the grievance officer, start there.
{{/clause}}

{{#clause id=CONTACT.DELETION}}
## Asking us to delete your data

**{{ facts.deletion_route.mailbox }}** is the route, and it is monitored.

You do not need an account to write to it, and you do not need to explain why. What happens next is set out in the [Privacy Policy]({{ facts.routes.privacy }}).
{{/clause}}
