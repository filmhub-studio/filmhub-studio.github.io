# Film Hub

Your own film production hub: script development and coverage, mood board, colour palette, shot list,
budget, schedule, call sheets, risk assessment, casting, location recce, lighting & blocking planner,
false colour, learning labs, a community board with Discord, and Google sign-in to share projects with your crew.

## 1. Put it online with GitHub Pages
1. Create a free account at github.com (or sign in).
2. Click **+ → New repository**, name it `film-hub`, choose **Public**, then **Create repository**.
3. On the new repository page click **uploading an existing file**, drag in everything from this folder
   (`index.html`, `README.md` and the whole `tools` folder), then **Commit changes**.
4. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, **Save**.
5. After a minute your hub is live at `https://YOUR-USERNAME.github.io/film-hub/`.

To update it later, upload the changed files again (same names) and commit.

## 2. Turn on Google sign-in (Firebase project "lighting-planner")
1. Open console.firebase.google.com → **lighting-planner**.
2. **Authentication → Get started → Sign-in method → Google → Enable**, pick your support email, **Save**.
3. **Authentication → Settings → Authorized domains → Add domain**: `YOUR-USERNAME.github.io`
   (and `lightingplan.netlify.app` if you keep that site too).

## 3. Firestore rules
**Firestore Database → Rules.** Keep the rule you already have for `planners` (the Lighting Planner), and add the
`hubProjects`, `community_notes`, `community_config` and `hub_users` blocks inside the same `match /databases/{database}/documents { … }`.
If you are not sure, replace everything with this and press **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Lighting Planner (shared by invite link, as before)
    match /planners/{ws}/{document=**} {
      allow read, write: if true;
    }

    // Film Hub shared projects: only invited Google accounts
    function signedIn() { return request.auth != null; }
    function myEmail() { return request.auth.token.email.lower(); }
    match /hubProjects/{pid} {
      allow read: if signedIn() && myEmail() in resource.data.members;
      allow create: if signedIn() && request.resource.data.owner == request.auth.uid;
      allow update: if signedIn() && myEmail() in resource.data.members;
      allow delete: if signedIn() && resource.data.owner == request.auth.uid;
      match /tools/{tool} {
        allow read, write: if signedIn() && myEmail() in get(/databases/$(database)/documents/hubProjects/$(pid)).data.members;
      }
    }

    // Community
    match /community_notes/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
      allow update: if signedIn();
      allow delete: if signedIn() && (resource.data.uid == request.auth.uid
                    || get(/databases/$(database)/documents/community_config/main).data.owner == request.auth.uid);
    }
    match /community_config/{id} {
      allow read: if signedIn();
      allow write: if signedIn() && (!exists(/databases/$(database)/documents/community_config/$(id))
                    || resource.data.owner == request.auth.uid);
    }
    match /hub_users/{uid} {
      allow read: if signedIn();
      allow write: if signedIn() && uid == request.auth.uid;
    }
  }
}
```

## 4. Discord
Open the hub → **Community** → **Settings** on the Discord card, paste your invite link (set to never expire)
and, for the live "who's online" panel, your Server ID (Server Settings → Widget → Enable Server Widget).
The first person to save these settings becomes their owner.

## How saving works
- Not signed in: everything stays in your browser. Use **Projects → Backup** to keep a copy.
- Signed in: press **Share** on a project to put it online, then invite people by their Google email.
  Everyone in the project sees changes live. Images make projects big; very large mood boards may be too big to sync.
- Script Coverage keeps the script PDF on each computer (everyone loads their own copy); notes and the report are shared.
- The Lighting Planner keeps its own projects and invite links, as before.

## Canva (moodboard → Canva)

Canva's API cannot be called straight from a web page and needs a secret key, so a tiny helper server sits in between. It is in the `canva-proxy` folder.

1. Go to https://www.canva.com/developers → Your integrations → Create an integration (type: Public if friends will use it, Private for just you/your team).
   - Scopes: asset read/write, design content read/write, design meta read, brand template meta/content read, profile read.
   - Authorized redirect: `https://YOURNAME.github.io/REPO/tools/canva-callback.html`
   - Copy the Client ID and generate a Client secret.
2. Deploy `canva-proxy` to Netlify (drag the folder into app.netlify.com → Add new site → Deploy manually, or connect it as its own GitHub repo).
   Site settings → Environment variables: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `ALLOWED_ORIGIN` = `https://YOURNAME.github.io`
3. In Film Hub → Mood Board → 🎨 Canva, paste `https://YOUR-PROXY.netlify.app/canva`, then Connect.

Notes: sync is one way (tool → Canva). Canva's API can't edit an existing design, so "Update" uploads new images to your Canva Uploads (and, with a Brand template ID, creates a fresh autofilled design). Autofill / brand templates need Canva Enterprise. A Public integration has to pass Canva's review before people outside your team can connect; each person connects their own Canva account.
