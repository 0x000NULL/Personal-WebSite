import { pool } from '../config/database';
import { PoolClient } from 'pg';

export interface DatabaseTransaction {
  client: PoolClient;
  query: (text: string, params?: any[]) => Promise<any>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Execute multiple database operations in a transaction
 * Automatically handles commit/rollback and client cleanup
 */
export async function withTransaction<T>(
  callback: (transaction: DatabaseTransaction) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const transaction: DatabaseTransaction = {
      client,
      query: (text: string, params?: any[]) => client.query(text, params),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK')
    };
    
    const result = await callback(transaction);
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with row-level locking to prevent race conditions
 */
export async function withRowLock<T>(
  tableName: string,
  whereClause: string,
  params: any[],
  callback: (lockedRows: any[]) => Promise<T>
): Promise<T> {
  return withTransaction(async (transaction) => {
    // Lock the rows
    const lockQuery = `
      SELECT * FROM ${tableName} 
      WHERE ${whereClause} 
      FOR UPDATE
    `;
    
    const result = await transaction.query(lockQuery, params);
    const lockedRows = result.rows;
    
    // Execute callback with locked rows
    return await callback(lockedRows);
  });
}

/**
 * Execute queries with optimistic locking using version numbers
 */
export async function withOptimisticLock(
  tableName: string,
  id: string,
  expectedVersion: number,
  updateCallback: (transaction: DatabaseTransaction) => Promise<void>
): Promise<void> {
  return withTransaction(async (transaction) => {
    // Check current version
    const versionCheck = await transaction.query(
      `SELECT version FROM ${tableName} WHERE id = $1`,
      [id]
    );
    
    if (versionCheck.rows.length === 0) {
      throw new Error('Record not found');
    }
    
    const currentVersion = versionCheck.rows[0].version;
    if (currentVersion !== expectedVersion) {
      throw new Error('Record has been modified by another process');
    }
    
    // Execute update
    await updateCallback(transaction);
    
    // Increment version
    await transaction.query(
      `UPDATE ${tableName} SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  });
}

/**
 * Utility for safe database operations with proper error handling
 */
export async function safeQuery<T = any>(
  query: string,
  params?: any[],
  errorMessage?: string
): Promise<T[]> {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error: any) {
    console.error('Database query error:', {
      query,
      params,
      error: error.message,
      stack: error.stack
    });
    
    // Rethrow with more context
    const contextualError = new Error(errorMessage || 'Database operation failed');
    (contextualError as any).originalError = error;
    (contextualError as any).query = query;
    (contextualError as any).params = params;
    
    throw contextualError;
  }
}

/**
 * Utility for paginated queries with proper type safety
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginatedQuery<T = any>(
  baseQuery: string,
  countQuery: string,
  params: any[] = [],
  pagination: PaginationParams = {}
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.max(1, Math.min(100, pagination.limit || 20));
  const offset = pagination.offset ?? (page - 1) * limit;
  
  // Execute count and data queries in parallel
  const [countResult, dataResult] = await Promise.all([
    safeQuery(countQuery, params),
    safeQuery(`${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, 
              [...params, limit, offset])
  ]);
  
  const total = parseInt(countResult[0]?.count || '0');
  const pages = Math.ceil(total / limit);
  
  return {
    data: dataResult,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1
    }
  };
}

/**
 * Utility for executing multiple queries atomically
 */
export async function executeInTransaction(queries: Array<{
  query: string;
  params?: any[];
  errorMessage?: string;
}>): Promise<any[]> {
  return withTransaction(async (transaction) => {
    const results = [];
    
    for (const queryConfig of queries) {
      try {
        const result = await transaction.query(queryConfig.query, queryConfig.params);
        results.push(result.rows);
      } catch (error: any) {
        console.error('Transaction query failed:', {
          query: queryConfig.query,
          params: queryConfig.params,
          error: error.message
        });
        
        throw new Error(queryConfig.errorMessage || `Transaction failed: ${error.message}`);
      }
    }
    
    return results;
  });
}