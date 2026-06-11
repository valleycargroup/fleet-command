# Global State — Fleet Command

All global state lives in `apps/client/src/lib/store.ts` via Zustand.

---

## Reading state in a component

```ts
import { useStore } from '../lib/store'

function MyComponent() {
  const vehicles = useStore(s => s.vehicles)
  const notify   = useStore(s => s.notify)
  // ...
}
```

The selector `s => s.vehicles` subscribes the component to that slice only — it won't re-render when unrelated state changes.

### Role flags

Use the `selectRoles` selector instead of reading `currentUser` manually:

```ts
import { useStore, selectRoles } from '../lib/store'

const { isAdmin, isVendor, isAP } = useStore(selectRoles)
```

### Reading state outside React (e.g. intervals, callbacks)

```ts
import { useStore } from '../lib/store'

const vehicles = useStore.getState().vehicles
useStore.setState({ loading: true })
```

---

## State reference

| Key | Type | Description |
|-----|------|-------------|
| `currentUser` | `object \| null` | Logged-in user object |
| `authToken` | `string \| null` | JWT from sessionStorage |
| `vehicles` | `array` | All mapped vehicle records |
| `vendors` | `object` | Keyed by recon category (`detail`, `bodyshop`, etc.) |
| `users` | `array` | Buyer/admin users |
| `allUsers` | `array` | All users (same as users currently) |
| `regVendors` | `array` | Registered vendor records for admin panel |
| `apiReady` | `boolean` | True once first API load completes |
| `loading` | `boolean` | True during `loadData` |
| `csvUploading` | `boolean` | True during CSV upload |
| `tab` | `string` | Active tab: `"active"`, `"sold"`, `"reports"`, etc. |
| `selV` | `object \| null` | Currently selected vehicle (opens VehicleDetail) |
| `fLoc` | `string` | Location filter: `"All"`, `"PHX"`, `"Dallas"` |
| `search` | `string` | Search bar text |
| `note` | `string \| null` | Current toast notification message |
| `showAdd` | `boolean` | Whether AddVehicleModal is open |
| `deepLinkCat` | `string \| null` | Recon category to auto-expand via URL |
| `pendingDeepLink` | `object \| null` | `{ vid, vcat }` parsed from URL on load |

---

## Actions reference

| Action | Signature | Description |
|--------|-----------|-------------|
| `handleLogin` | `(user, token)` | Sets auth, writes to sessionStorage |
| `handleLogout` | `()` | Clears auth + sessionStorage |
| `loadData` | `async ()` | Fetches vehicles, vendors, users from API |
| `upd` | `(id, updates)` | Updates vehicle in state + syncs to API |
| `addVehicle` | `async (vehicle)` | POSTs to API, prepends to vehicles list |
| `deleteVehicle` | `async (vehicle)` | Removes from state, DELETEs from API |
| `syncVehicle` | `async (vehicle)` | PUTs full vehicle to API (called by `upd`) |
| `handleCSVUpload` | `async (file)` | Uploads CSV, reloads vehicles from API |
| `fireEmail` | `async (type, data)` | POSTs to email worker |
| `notify` | `(msg)` | Shows toast for 3.5s |
| `setTab` | `(tab)` | Changes tab, clears selected vehicle |
| `setSelV` | `(vehicle \| null)` | Opens/closes VehicleDetail |
| `setFLoc` | `(location)` | Sets location filter |
| `setSearch` | `(text)` | Sets search text |
| `setShowAdd` | `(bool)` | Opens/closes AddVehicleModal |
| `setVendors` | `(vendors)` | Replaces vendor map |
| `setUsers` | `(users)` | Replaces users list |
| `setAllUsers` | `(users)` | Replaces allUsers list |
| `setRegVendors` | `(vendors)` | Replaces registered vendors list |

---

## Adding new state

**1. Add the field and setter to the store:**

```ts
// in store.ts, inside create()
myNewFlag: false,
setMyNewFlag: (val: boolean) => set({ myNewFlag: val }),
```

**2. Use it in any component:**

```ts
const myNewFlag = useStore(s => s.myNewFlag)
const setMyNewFlag = useStore(s => s.setMyNewFlag)
```

That's it. No Provider, no action creators, no reducers.

---

## Adding a new async action

```ts
// in store.ts, inside create()
doSomething: async (id: string) => {
  const { api, notify } = get()   // get() reads current state
  try {
    const res = await api('/api/something/' + id, 'POST', { id })
    set(state => ({ things: [...state.things, res.thing] }))
    notify('Done!')
  } catch (e: any) {
    notify('Failed: ' + e.message)
  }
},
```

Key points:
- `get()` reads current state synchronously (safe to call anywhere inside an action)
- `set()` merges — you only need to include keys that change
- `set(state => ...)` functional form when new value depends on old state

---

## Removing state

1. Delete the field (and its setter if it has one) from `store.ts`
2. Search the codebase for all `useStore(s => s.fieldName)` references and remove them

```
grep -r "s\.fieldName" apps/client/src
```

---

## Updating existing state from outside a component

For one-off mutations (e.g. after a background fetch):

```ts
import { useStore } from '../lib/store'

useStore.setState({ vehicles: updatedList })

// or functional form:
useStore.setState(state => ({
  vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...updates } : v)
}))
```

---

## Updating a vehicle

Always use `upd` — it updates both `vehicles` array and `selV` (the open detail panel) atomically, then syncs to the API:

```ts
const upd = useStore(s => s.upd)

upd(vehicle.id, { status: 'sold', soldDate: '2026-06-11' })
```

Do **not** call `setSelV` manually to update vehicle fields — it would update the panel but leave `vehicles` stale.
