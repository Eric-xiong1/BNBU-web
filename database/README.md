# 数据存储层

| 文件 | 说明 |
|------|------|
| `schema.sql` | MySQL 建表 DDL 与基础演示数据 |
| `run-seed.cjs` | 向远程测试库执行外部 seed SQL（部署前请修改连接配置） |

初始化数据库：

```bash
mysql -u user -p your_database < database/schema.sql
```
