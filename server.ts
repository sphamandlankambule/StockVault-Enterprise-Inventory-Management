import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const PHP_API_BASE_URL = process.env.PHP_API_BASE_URL || 'http://localhost/stockvault/api';

/**
 * Forward API calls to PHP API Backend (which relies on php_apis/db_connection.php for MySQL connection).
 * No direct MySQL / mysql2 connections exist in Node.js code.
 */
async function proxyToPhpApi(req: Request, res: Response, targetEndpoint: string) {
  try {
    const url = `${PHP_API_BASE_URL.replace(/\/$/, '')}/${targetEndpoint.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'] as string;
    if (req.headers['x-user-id']) headers['X-User-Id'] = req.headers['x-user-id'] as string;
    if (req.headers['x-user-role']) headers['X-User-Role'] = req.headers['x-user-role'] as string;

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const phpResponse = await fetch(url, fetchOptions);
    const responseText = await phpResponse.text();

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        success: false,
        error: `Database Connection Failed: PHP API endpoint at ${url} returned HTML or non-JSON output. Ensure MySQL database is active and php_apis/db_connection.php is properly configured.`
      });
    }

    res.status(phpResponse.status).json(data);
  } catch (err: any) {
    // If PHP API or db_connection.php is unreachable or fails PDO connection
    res.status(500).json({
      success: false,
      error: `Database Connection Failed: Unable to connect to MySQL database via php_apis/db_connection.php (${err?.message || 'PHP API backend unreachable at ' + PHP_API_BASE_URL})`
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      database_connector: 'php_apis/db_connection.php (PDO)',
      php_api_base_url: PHP_API_BASE_URL,
      node_mysql_direct: false
    });
  });

  // Database Connection Status endpoint
  app.get('/api/db/status', async (req: Request, res: Response) => {
    try {
      const response = await fetch(`${PHP_API_BASE_URL.replace(/\/$/, '')}/db_connection.php`);
      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        return res.status(500).json({
          success: false,
          error: `Database Connection Failed: php_apis/db_connection.php returned non-JSON output (HTML / PHP runtime error).`
        });
      }
      res.status(response.status).json(data);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Database Connection Failed: Unable to connect to MySQL database via php_apis/db_connection.php (${err?.message || 'Connection refused'})`
      });
    }
  });

  // All database API actions route via PHP API scripts using db_connection.php
  app.all('/api/auth', (req, res) => proxyToPhpApi(req, res, 'auth.php'));
  app.all('/api/users*', (req, res) => proxyToPhpApi(req, res, 'users.php'));
  app.all('/api/add-stock', (req, res) => proxyToPhpApi(req, res, 'add_stock.php'));
  app.all('/api/stock-out', (req, res) => proxyToPhpApi(req, res, 'stock_out.php'));
  app.all('/api/reports*', (req, res) => proxyToPhpApi(req, res, 'reports.php'));

  // Catch-all for any other /api/* route - forward to PHP API or return db_connection.php error
  app.all('/api/*', (req: Request, res: Response) => {
    const endpoint = req.params[0] || '';
    proxyToPhpApi(req, res, `${endpoint}.php`);
  });

  // Vite Dev Server / Static Serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StockVault Enterprise] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[StockVault Enterprise] Database Connection Mode: PHP PDO ONLY (php_apis/db_connection.php)`);
  });
}

startServer();
