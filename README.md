This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Configurer l'IA Gemini pour les analyses

Les analyses textuelles des pronostics sont enrichies via l'API Google Gemini. Pour activer cette intégration, ajoutez la clé dans votre environnement :

```bash
export GEMINI_API_KEY="votre_cle_secrete"
# Optionnel : choisir un autre modèle supporté
export GEMINI_MODEL="gemini-2.5-flash"
```

Sans définir `GEMINI_MODEL`, l'application utilise par défaut `gemini-2.5-flash`.

Sans clé valide, l'application conserve automatiquement les analyses internes prévues par le moteur de règles.

### Données de matchs en direct

Le moteur génère désormais les 9 pronostics à partir des tableaux de bord publics d'ESPN (football, tennis, basket). Lors de
chaque requête sur `/api/autopicks`, l'application :

- interroge les endpoints `scoreboard` des compétitions majeures sur les 4 prochains jours ;
- calcule des probabilités et une cote simulée à partir des bilans/rangs/formes disponibles ;
- fait appel à Gemini (si activé) pour reformuler l'analyse textuelle.

L'accès réseau sortant doit donc être autorisé pour récupérer des rencontres réellement programmées. En cas d'indisponibilité
des flux, un jeu de neuf rencontres de secours est renvoyé automatiquement pour garantir une réponse exploitable.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
