# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Running without a backend

Clerk authentication requires `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. The subscription
backend is optional: leave `EXPO_PUBLIC_API_BASE_URL` unset or blank in `.env` until
a backend is deployed.

After signing in, Home, Subscriptions, and Insights show their existing layouts
with empty data and a "Backend not connected" notice. Settings and sign-out remain
available. This mode does not create an API profile, load sample subscriptions, or
save subscriptions locally; add/edit/delete remain unavailable.

When a backend is ready, set `EXPO_PUBLIC_API_BASE_URL` to its public URL ending in
`/api/v1`, then restart Expo. This enables the existing authenticated API flow.
Invalid configured URLs and API request failures still display errors rather than
silently switching to empty data. Never put backend secrets in public Expo values.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
