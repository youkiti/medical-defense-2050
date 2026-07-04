# メディカルディフェンス2050 / Medical Defense 2050

2050年のニッポンの医療体制をやりくりする、タワーディフェンス風のシミュレーションゲームです。外来・病棟・救急・在宅介護・事務の5レーンに、医師・看護・コメディカル・事務のユニットを配置し、押し寄せる医療需要をさばききって最終年まで医療を守り抜きましょう。

▶ **プレイはこちら: https://youkiti.github.io/medical-defense-2050/**

> ⚠️ これはゲームであり、実際の医療政策を表すものではありません。

## 遊び方

- 1ターン＝1年。2026年からスタートし、難易度によって最終年が変わります（研修医は2040年、指導医・院長は2050年）。
- 5つのレーンに人材ユニットを配置。レーンごとに需要が処理力を超えると「ひっ迫ゲージ」が上昇します。
- ユニットをタップ→移動先のレーンをタップで再配置（1ターンに2回まで）。
- 「介入カード」で効率化やAI導入に投資できます。
- どれか1つのレーンでもひっ迫ゲージが100%に達するとゲームオーバー。全レーンを保ったまま最終年まで乗り切ればクリアです。
- 同じシード番号を指定すると同じ年表・同じイベント順を再現できます。友だちと同じシードで競いましょう。

## 題材・背景 ― 2040年に向けた地域医療構想

本ゲームは、厚生労働省が進める「[2040年に向けた地域医療構想](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000080850_00014.html)」を題材にしています。

85歳以上の高齢者の増加と現役世代の割合減少がさらに進む2040年とその先を見据え、医療提供体制をどう保つかが、この構想のテーマです。ゲームでは、この「守り抜く」感覚をタワーディフェンス風に体験できるようにしました。

> ⚠️ ゲーム内の数値・仕組みは体験のために簡略化・脚色したものであり、地域医療構想の内容や実際の医療政策を正確に表すものではありません。正確な情報は上記リンクの厚生労働省の公式ページをご確認ください。

## ローカルで動かす

```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm run build    # 本番ビルド（dist/ を生成）
npm run preview  # ビルド結果をローカル配信して確認
```

## 技術構成

- [Vite](https://vitejs.dev/) + [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
- [React 18](https://react.dev/)
- [Recharts](https://recharts.org/)（グラフ描画）
- [lucide-react](https://lucide.dev/)（アイコン）
- [Tailwind CSS v4](https://tailwindcss.com/)

`main` ブランチへの push をトリガーに、GitHub Actions（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）が自動でビルドし GitHub Pages へデプロイします。

## 出典

出典: [令和4年版厚生労働白書](https://www.mhlw.go.jp/stf/wp/hakusyo/kousei/21/)（厚生労働省, 2022）、[日本の将来推計人口 令和5年推計](https://www.ipss.go.jp/pp-zenkoku/j/zenkoku2023/pp2023_gaiyou.pdf)（国立社会保障・人口問題研究所, 2023）、[2040年に向けた地域医療構想](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000080850_00014.html)（厚生労働省）ほか。本ゲームは公的推計に基づくシミュレーションであり、将来を予測するものではありません。

## ライセンス

本プロジェクトのソースコードは [MIT License](LICENSE) で公開しています。Copyright (c) 2026 YukiKataoka3。

### サードパーティ

本ソフトウェアは以下のオープンソースライブラリを利用しています。

- React, React DOM — MIT License
- Recharts — MIT License
- Tailwind CSS — MIT License
- lucide-react — ISC License

## 制作

[@YukiKataoka3](https://x.com/YukiKataoka3)
