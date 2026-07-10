# BNBU 体育成绩管理 Web 交付验证记录

验证日期：2026-06-12

## 自测结果

命令：

```bash
node frontend/self-test.cjs
```

结果：

```text
BNBU Web self-test passed: {"routes":29,"endpoints":34,"downloads":4,"health":"ok","qualityGroups":3}
```

覆盖：

- 29 个 Web 路由渲染
- 34 个后端接口映射
- 角色越权路由回退
- 课程名单 CSV 预检
- 组织成员 CSV 预检
- 异常审核通过与驳回回滚
- API 健康检查
- 交付导出函数
- 质量门禁渲染
- 运行期错误兜底
- 本地状态污染防护

## 质量烟测结果

命令：

```bash
node frontend/quality-smoke.cjs
```

结果：

```json
{
  "ok": true,
  "webConcurrent": {
    "total": 200,
    "counts": {
      "200": 200
    }
  },
  "apiConcurrent": {
    "total": 200,
    "counts": {
      "200": 200
    }
  }
}
```

覆盖：

- Web 预览安全响应头
- POST 方法限制
- 路径穿越防护
- mock API CORS
- mock API 安全响应头
- mock API 健康检查
- Web 静态资源 200 并发请求
- mock API 健康接口 200 并发请求

## 运行服务

Web 预览：

```text
http://127.0.0.1:4174/index.html?fresh=quality-v1
```

Mock API：

```text
http://127.0.0.1:8080/api/health
```

## 交付判断

当前 Web 前端已经达到后端负责人联调交付水平。后端接入后，应按 `backend/integration-checklist.md` 完成接口、权限、审计、并发、安全和浏览器兼容验收。
