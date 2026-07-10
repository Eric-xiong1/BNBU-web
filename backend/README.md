# 业务逻辑层

Express API 服务、OpenAPI 契约与联调材料。

## 结构

```text
backend/
├── server.js           生产 API（MySQL）
├── mock-api.cjs        联调 Mock
├── openapi.yaml        接口草案
├── test/               API 测试
└── …                   数据字典、联调清单等
```

## 启动

```bash
npm install --prefix backend   # 首次
npm run mock-api               # Mock :8080
npm run api                    # 完整后端
npm run test:api               # 运行测试
```

数据库 DDL 见 `../database/schema.sql`。
