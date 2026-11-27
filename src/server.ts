import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import 'express-async-errors';
import { authMiddleware } from './middleware/auth.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DeskOps Phase 1 - Ticketing Core',
    version: '1.0.0'
  });
});

// API routes (require auth + tenant middleware)
app.use('/api', authMiddleware, tenantMiddleware);

// Example protected endpoint
app.get('/api/me', (req: Request, res: Response) => {
  res.json({
    user: req.user
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: \Route \ \ not found\
    }
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    }
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(\🚀 DeskOps server running on port \\);
    console.log(\📍 Health check: http://localhost:\/health\);
    console.log(\🔐 Environment: \\);
  });
}

export default app;
