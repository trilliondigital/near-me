# Geofencing Tuning Guide

Registration: rolling top-N geofences; prioritize likely POIs and route-ahead.
Radii defaults: Category 5/3/1 mi; Home 2mi+arrival+T+5; Work 5mi+arrival+T+5.
Dedup: per-task cooldown (8–10m); global cooldown (3–5m); bundle dense corridors.
Heading/speed guards; battery escalation near candidates; handle tunnels/urban canyons.