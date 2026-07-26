# Success Metrics

**Primary**
- **SM-1**: Voyage completion rate — % of started Voyages that reach End Voyage (CAP-6) with 2+ Voyagers joined. Validates CAP-3, CAP-5, CAP-6.
- **SM-2**: Join conversion rate — % of Join Code/Link opens (CAP-5) that complete OTP authentication (CAP-1) and successfully join. Validates CAP-1, CAP-5.

**Secondary**
- **SM-3**: Repeat Voyage rate — % of Organizers who start a second Voyage within 90 days, even without Memory Lane's pull in v1. The core signal that the bare v1 loop has standalone value before investing in v1.1.
- **SM-4**: Invite K-factor — average Join Code/Link sends per Organizer × conversion rate of those invites into joined Voyagers. Target > 1.0 for compounding growth. Validates CAP-4, CAP-5.

**Counter-metrics (do not optimize)**
- **SM-C1**: Battery drain per hour of active tracking — must not be sacrificed to make the live map (CAP-9) feel more "real-time" via higher-frequency location pings. Counterbalances SM-3.
- **SM-C2**: OTP failure/resend rate — join conversion (SM-2) must not be inflated by loosening auth reliability or security (CAP-1).
