import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all inventory items
export const getInventoryItems = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { category, lowStock, search, limit = '50', offset = '0' } = req.query;

    const where: any = { kennelId };

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Calculate if stock is low
    const itemsWithStatus = items.map((item) => ({
      ...item,
      isLowStock: item.quantity <= item.minStock,
    }));

    // Filter by low stock if requested
    let filteredItems = itemsWithStatus;
    if (lowStock === 'true') {
      filteredItems = itemsWithStatus.filter((item) => item.isLowStock);
    }

    const total = await prisma.inventoryItem.count({ where });

    // Get category summary
    const categorySummary = await prisma.inventoryItem.groupBy({
      by: ['category'],
      where: { kennelId },
      _count: { id: true },
      _sum: { quantity: true, cost: true },
    });

    res.json({
      items: filteredItems,
      total,
      summary: categorySummary,
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({ error: 'Error fetching inventory items' });
  }
};

// Get inventory item by ID
export const getInventoryItemById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({
      item: {
        ...item,
        isLowStock: item.quantity <= item.minStock,
      },
    });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Error fetching inventory item' });
  }
};

// Create inventory item
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { name, category, description, quantity, unit, minStock, cost, supplier } = req.body;

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Name, category and unit are required' });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        description,
        quantity: parseFloat(quantity) || 0,
        unit,
        minStock: parseFloat(minStock) || 0,
        cost: cost ? parseFloat(cost) : null,
        supplier,
        kennelId,
        movements: {
          create: {
            type: 'IN',
            quantity: parseFloat(quantity) || 0,
            reason: 'INITIAL',
            notes: 'Stock inicial',
          },
        },
      },
      include: {
        movements: true,
      },
    });

    res.status(201).json({ item, message: 'Inventory item created successfully' });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Error creating inventory item' });
  }
};

// Update inventory item
export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, minStock, cost, supplier, unit } = req.body;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name,
        description,
        minStock: minStock ? parseFloat(minStock) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        supplier,
        unit,
      },
    });

    res.json({ item, message: 'Inventory item updated successfully' });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Error updating inventory item' });
  }
};

// Delete inventory item
export const deleteInventoryItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.inventoryItem.delete({
      where: { id },
    });

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Error deleting inventory item' });
  }
};

// Record inventory movement (IN or OUT)
export const recordMovement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, quantity, reason, notes } = req.body;

    if (!type || !quantity || !reason) {
      return res.status(400).json({ error: 'Type, quantity and reason are required' });
    }

    const qty = parseFloat(quantity);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Calculate new quantity
    let newQuantity = item.quantity;
    if (type === 'IN') {
      newQuantity += qty;
    } else if (type === 'OUT') {
      if (item.quantity < qty) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      newQuantity -= qty;
    }

    // Update item and create movement in transaction
    const [updatedItem, movement] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id },
        data: { quantity: newQuantity },
      }),
      prisma.inventoryMovement.create({
        data: {
          type,
          quantity: qty,
          reason,
          notes,
          itemId: id,
        },
      }),
    ]);

    res.json({
      item: updatedItem,
      movement,
      message: 'Movement recorded successfully',
    });
  } catch (error) {
    console.error('Record movement error:', error);
    res.status(500).json({ error: 'Error recording movement' });
  }
};

// Adjust inventory (correction)
export const adjustInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newQuantity, reason, notes } = req.body;

    if (newQuantity === undefined || !reason) {
      return res.status(400).json({ error: 'New quantity and reason are required' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const difference = parseFloat(newQuantity) - item.quantity;
    const type = difference >= 0 ? 'IN' : 'OUT';

    const [updatedItem, movement] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id },
        data: { quantity: parseFloat(newQuantity) },
      }),
      prisma.inventoryMovement.create({
        data: {
          type,
          quantity: Math.abs(difference),
          reason: 'ADJUSTMENT',
          notes: notes || `Ajuste de inventario: ${reason}`,
          itemId: id,
        },
      }),
    ]);

    res.json({
      item: updatedItem,
      movement,
      message: 'Inventory adjusted successfully',
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({ error: 'Error adjusting inventory' });
  }
};

// Get inventory statistics
export const getInventoryStats = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;

    const totalItems = await prisma.inventoryItem.count({ where: { kennelId } });

    const lowStockItems = await prisma.inventoryItem.count({
      where: {
        kennelId,
        quantity: { lte: prisma.inventoryItem.fields.minStock },
      },
    });

    const totalValue = await prisma.inventoryItem.aggregate({
      where: { kennelId },
      _sum: {
        cost: true,
      },
    });

    const categoryBreakdown = await prisma.inventoryItem.groupBy({
      by: ['category'],
      where: { kennelId },
      _count: { id: true },
      _sum: { quantity: true },
    });

    // Recent movements
    const recentMovements = await prisma.inventoryMovement.findMany({
      where: {
        item: { kennelId },
      },
      include: {
        item: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      totalItems,
      lowStockItems,
      totalValue: totalValue._sum.cost || 0,
      categoryBreakdown,
      recentMovements,
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({ error: 'Error fetching inventory statistics' });
  }
};

// Get low stock alerts
export const getLowStockAlerts = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;

    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        kennelId,
        quantity: { lte: prisma.inventoryItem.fields.minStock },
      },
      orderBy: { quantity: 'asc' },
    });

    const itemsWithInfo = lowStockItems.map((item) => ({
      ...item,
      shortage: item.minStock - item.quantity,
      isOutOfStock: item.quantity === 0,
    }));

    res.json({
      items: itemsWithInfo,
      count: itemsWithInfo.length,
      outOfStockCount: itemsWithInfo.filter((i) => i.isOutOfStock).length,
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({ error: 'Error fetching low stock alerts' });
  }
};
