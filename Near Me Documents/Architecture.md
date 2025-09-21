# Architecture

```other
flowchart LR
A(App) -- Task/Prefs --> B(API)
A -- Location --> C(Geofencing)
C --> D(Notifications)
D --> A
B --> E(DB)
B --> F(POI)
A --> G(Analytics) --> H(Warehouse)
```