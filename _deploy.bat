@echo off
git add src/components/CategoryMenu.tsx src/components/ProductCard.tsx src/index.css src/lib/categories.ts src/pages/Index.tsx
git commit -m "feat: mobile responsiveness improvements"
git push origin main
echo.
echo === Push concluido! Fazendo redeploy na Vercel... ===
npx vercel --prod --yes
echo.
echo === Deploy finalizado! ===
pause
