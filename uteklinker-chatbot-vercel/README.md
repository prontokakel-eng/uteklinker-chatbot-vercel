# Uteklinker Chatbot Backend (Vercel)

This is a simple Vercel serverless backend to connect your chatbot frontend with OpenAI.

## Deploy

1. Push this project to GitHub.
2. Connect the repo in [Vercel](https://vercel.com/).
3. Add environment variable in Vercel project settings:

```
OPENAI_API_KEY=your_openai_api_key
```

4. Deploy.

Your endpoint will be:
```
https://your-vercel-app.vercel.app/api/chat
```

Update your chatbot HTML to call this endpoint.
