# ホストには docker 以外何も入れない。CI（GitHub Actions）も同じターゲットを走らせる。
NODE := node:24.22.0-slim
RUN  := docker run --rm -v $(CURDIR):/work -v ai-yagni-data-frontend-modules:/work/node_modules -w /work $(NODE)

.DEFAULT_GOAL := help
.PHONY: help install typecheck test build ci image dev

help: ## このヘルプ
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## 依存を入れる（package-lock.json のとおり）
	$(RUN) npm ci --no-audit --no-fund

typecheck: install ## 型検査
	$(RUN) npm run typecheck

test: install ## テスト
	$(RUN) npm test

build: install ## 静的ファイルを作る（dist/）
	$(RUN) npm run build

ci: typecheck test build ## CI で走らせるもの全部

image: ## nginx のイメージを作る
	docker build -t ai-yagni-data-frontend .

dev: install ## 開発サーバー（http://localhost:5173、/api は BACKEND_URL に渡す）
	docker run --rm -it -p 5173:5173 -e BACKEND_URL=$${BACKEND_URL:-http://host.docker.internal:8000} \
	  -v $(CURDIR):/work -v ai-yagni-data-frontend-modules:/work/node_modules -w /work $(NODE) npm run dev
