import type {
  Database,
  InventoryItem,
  MovementReason,
  Order,
  OrderItem,
  Payment,
  StockLevel,
  StockMovement,
} from '@/types/domain';
import { daysAgo, dayOffset, nowIso } from '@/utils/date';

const OPENED = daysAgo(30, 8, 0);
const OPENED_BY = 'Demo Owner';

function item(
  id: string,
  sku: string,
  name: string,
  kind: InventoryItem['kind'],
  unit: InventoryItem['unit'],
  costPerUnitCents: number,
  reorderLevel: number,
  productId?: string,
): InventoryItem {
  return { id, sku, name, kind, unit, costPerUnitCents, reorderLevel, productId };
}

function orderItem(
  description: string,
  quantity: number,
  unitPriceCents: number,
  productId?: string,
): OrderItem {
  return {
    id: `oi_${Math.random().toString(36).slice(2, 9)}`,
    productId,
    description,
    quantity,
    unitPriceCents,
  };
}

export function seedDatabase(): Database {
  const products = [
    {
      id: 'p_vanilla',
      name: 'Vanilla Custard',
      slug: 'vanilla-custard',
      tagline: 'Silky vanilla custard in a crisp shell',
      description:
        'A slow-set vanilla custard finished with fresh cream. Bright, gentle and made for slow afternoons.',
      priceCents: 450000,
      isPublished: true,
      isAvailable: true,
      artIndex: 0,
      sortOrder: 1,
    },
    {
      id: 'p_chocolate',
      name: 'Chocolate Custard',
      slug: 'chocolate-custard',
      tagline: 'Dark chocolate, soft cream, a clean finish',
      description:
        'Deep dark-chocolate custard with a whisper of cocoa and a cloud of whipped cream. Rich without heaviness.',
      priceCents: 480000,
      isPublished: true,
      isAvailable: true,
      artIndex: 1,
      sortOrder: 2,
    },
    {
      id: 'p_mocha',
      name: 'Mocha',
      slug: 'mocha',
      tagline: 'Espresso custard with cocoa dust',
      description:
        'A mellow espresso custard, layered with cream and dusted with cocoa. Our most-requested morning bake.',
      priceCents: 500000,
      isPublished: true,
      isAvailable: true,
      artIndex: 2,
      sortOrder: 3,
    },
    {
      id: 'p_mille',
      name: 'Mille-feuille',
      slug: 'mille-feuille',
      tagline: 'A thousand layers of pastry and cream',
      description:
        'Hand-laminated puff pastry, vanilla crème and a fine sugar glaze. Best eaten the day it is baked.',
      priceCents: 550000,
      isPublished: true,
      isAvailable: true,
      artIndex: 3,
      sortOrder: 4,
    },
    {
      id: 'p_creampuff',
      name: 'Cream Puffs',
      slug: 'cream-puffs',
      tagline: 'Box of six, filled to order',
      description:
        'Choux puffs filled with vanilla cream at the counter, so the pastry stays crisp. Sold as a box of six.',
      priceCents: 380000,
      isPublished: true,
      isAvailable: true,
      artIndex: 4,
      sortOrder: 5,
    },
    {
      id: 'p_strawberry',
      name: 'Strawberry Tart',
      slug: 'strawberry-tart',
      tagline: 'Seasonal strawberries on vanilla cream',
      description:
        'A tart shell baked until golden, filled with vanilla cream and crowned with fresh strawberries.',
      priceCents: 420000,
      isPublished: true,
      isAvailable: true,
      artIndex: 5,
      sortOrder: 6,
    },
    {
      id: 'p_choc_tart',
      name: 'Chocolate Tart',
      slug: 'chocolate-tart',
      tagline: 'Dark ganache in a buttery shell',
      description:
        'A short, buttery tart shell filled with dark chocolate ganache and finished with a little sea salt.',
      priceCents: 420000,
      isPublished: true,
      isAvailable: true,
      artIndex: 6,
      sortOrder: 7,
    },
  ];

  const inventoryItems: InventoryItem[] = [
    item('ing_flour', 'RM-001', 'Plain flour', 'raw', 'kg', 120000, 20),
    item('ing_sugar', 'RM-002', 'Caster sugar', 'raw', 'kg', 150000, 15),
    item('ing_butter', 'RM-003', 'Unsalted butter', 'raw', 'kg', 320000, 10),
    item('ing_eggs', 'RM-004', 'Eggs', 'raw', 'pcs', 25000, 120),
    item('ing_milk', 'RM-005', 'Whole milk', 'raw', 'l', 180000, 20),
    item('ing_cream', 'RM-006', 'Whipping cream', 'raw', 'l', 450000, 10),
    item('ing_chocolate', 'RM-007', 'Dark chocolate', 'raw', 'kg', 480000, 8),
    item('ing_cocoa', 'RM-008', 'Cocoa powder', 'raw', 'kg', 520000, 4),
    item('ing_coffee', 'RM-009', 'Espresso powder', 'raw', 'kg', 600000, 2),
    item('ing_vanilla', 'RM-010', 'Vanilla extract', 'raw', 'l', 900000, 2),
    item('ing_strawberry', 'RM-011', 'Fresh strawberries', 'raw', 'kg', 350000, 6),
    item('ing_puff', 'RM-012', 'Puff pastry', 'raw', 'kg', 300000, 8),
    item('pkg_cakebox', 'PK-001', 'Cake box (large)', 'packaging', 'pcs', 40000, 50),
    item('pkg_tartbox', 'PK-002', 'Tart box', 'packaging', 'pcs', 25000, 60),
    item('pkg_bag', 'PK-003', 'Paper bag', 'packaging', 'pcs', 15000, 100),
    item('fin_vanilla', 'FG-001', 'Vanilla Custard (finished)', 'finished', 'pcs', 210000, 6, 'p_vanilla'),
    item('fin_chocolate', 'FG-002', 'Chocolate Custard (finished)', 'finished', 'pcs', 235000, 6, 'p_chocolate'),
    item('fin_mocha', 'FG-003', 'Mocha (finished)', 'finished', 'pcs', 245000, 6, 'p_mocha'),
    item('fin_mille', 'FG-004', 'Mille-feuille (finished)', 'finished', 'pcs', 290000, 4, 'p_mille'),
    item('fin_creampuff', 'FG-005', 'Cream Puffs (finished)', 'finished', 'pcs', 150000, 12, 'p_creampuff'),
    item('fin_strawberry_tart', 'FG-006', 'Strawberry Tart (finished)', 'finished', 'pcs', 200000, 5, 'p_strawberry'),
    item('fin_choc_tart', 'FG-007', 'Chocolate Tart (finished)', 'finished', 'pcs', 210000, 5, 'p_choc_tart'),
  ];

  const movements: StockMovement[] = [];

  const move = (
    itemId: string,
    location: StockLevel['location'],
    quantityDelta: number,
    reason: MovementReason,
    createdAt: string,
    refId?: string,
    note?: string,
    createdBy = OPENED_BY,
  ) => {
    movements.push({
      id: `mv_${movements.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
      itemId,
      location,
      quantityDelta,
      reason,
      refId,
      note,
      createdAt,
      createdBy,
    });
  };

  const openings: Array<[string, 'home_bakery' | 'cafe', number]> = [
    ['ing_flour', 'home_bakery', 80],
    ['ing_sugar', 'home_bakery', 60],
    ['ing_butter', 'home_bakery', 40],
    ['ing_eggs', 'home_bakery', 600],
    ['ing_milk', 'home_bakery', 60],
    ['ing_cream', 'home_bakery', 45],
    ['ing_chocolate', 'home_bakery', 30],
    ['ing_cocoa', 'home_bakery', 10],
    ['ing_coffee', 'home_bakery', 5],
    ['ing_vanilla', 'home_bakery', 6],
    ['ing_strawberry', 'home_bakery', 18],
    ['ing_puff', 'home_bakery', 25],
    ['pkg_cakebox', 'home_bakery', 300],
    ['pkg_tartbox', 'home_bakery', 240],
    ['pkg_bag', 'home_bakery', 500],
    ['fin_vanilla', 'home_bakery', 10],
    ['fin_chocolate', 'home_bakery', 8],
    ['fin_mocha', 'home_bakery', 6],
    ['fin_mille', 'home_bakery', 4],
    ['fin_creampuff', 'home_bakery', 30],
    ['fin_strawberry_tart', 'home_bakery', 8],
    ['fin_choc_tart', 'home_bakery', 6],
    ['pkg_cakebox', 'cafe', 80],
    ['pkg_tartbox', 'cafe', 60],
    ['pkg_bag', 'cafe', 200],
    ['fin_vanilla', 'cafe', 6],
    ['fin_chocolate', 'cafe', 5],
    ['fin_mocha', 'cafe', 12],
    ['fin_mille', 'cafe', 2],
    ['fin_creampuff', 'cafe', 40],
    ['fin_strawberry_tart', 'cafe', 4],
    ['fin_choc_tart', 'cafe', 4],
  ];

  openings.forEach(([itemId, location, qty]) => {
    move(itemId, location, qty, 'opening', OPENED, undefined, 'Opening balance (demo data)');
  });

  const customers = [
    {
      id: 'c_walkin',
      kind: 'individual' as const,
      name: 'Walk-in customer',
      createdAt: OPENED,
      isWalkIn: true,
    },
    {
      id: 'c_demo_ind',
      kind: 'individual' as const,
      name: 'Demo Customer — Individual',
      phone: '000 000 0000',
      email: 'customer@seasonscake.demo',
      notes: 'Demo record. Replace with a real customer profile.',
      createdAt: daysAgo(21),
    },
    {
      id: 'c_brightline',
      kind: 'organization' as const,
      name: 'Brightline Demo Ltd',
      organization: 'Brightline Demo Ltd',
      phone: '000 000 0001',
      email: 'orders@brightline.demo',
      notes: 'Demo corporate account.',
      createdAt: daysAgo(16),
    },
    {
      id: 'c_website',
      kind: 'individual' as const,
      name: 'Demo Website Visitor',
      email: 'visitor@seasonscake.demo',
      notes: 'Created from the website custom-order form (demo).',
      createdAt: daysAgo(1),
    },
  ];

  const orders: Order[] = [];
  const payments: Payment[] = [];

  const makeOrder = (data: Omit<Order, 'createdAt' | 'updatedAt'> & { at: string }): Order => {
    const { at, ...rest } = data;
    const record: Order = { ...rest, createdAt: at, updatedAt: at };
    orders.push(record);
    return record;
  };

  const makePayment = (data: Omit<Payment, 'id'>): Payment => {
    const record: Payment = { ...data, id: `pay_${payments.length + 1}_${Math.random().toString(36).slice(2, 6)}` };
    payments.push(record);
    return record;
  };

  const posOrder = (
    id: string,
    code: string,
    at: string,
    items: OrderItem[],
    method: Payment['method'],
    customerId = 'c_walkin',
    location: Order['location'] = 'cafe',
  ) => {
    const total = items.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
    makeOrder({
      id,
      code,
      type: 'regular',
      status: 'fulfilled',
      source: 'pos',
      customerId,
      items,
      location,
      notes: 'Seeded demo sale.',
      at,
    });
    makePayment({
      orderId: id,
      customerId,
      kind: 'payment',
      role: 'final',
      method,
      amountCents: total,
      location,
      createdAt: at,
    });
    items.forEach((line) => {
      const finishedItem = inventoryItems.find((inv) => inv.productId === line.productId);
      if (finishedItem) {
        move(finishedItem.id, location, -line.quantity, 'sale', at, id, `Sale ${code}`);
      }
    });
  };

  posOrder(
    'ord_pos_1002',
    'POS-1002',
    daysAgo(20, 13, 5),
    [orderItem('Mocha', 1, 500000, 'p_mocha'), orderItem('Chocolate Custard', 1, 480000, 'p_chocolate')],
    'transfer',
  );

  posOrder(
    'ord_pos_1003',
    'POS-1003',
    daysAgo(13, 15, 40),
    [orderItem('Mille-feuille', 1, 550000, 'p_mille'), orderItem('Cream Puffs', 3, 380000, 'p_creampuff')],
    'card',
    'c_demo_ind',
  );

  posOrder(
    'ord_pos_1004',
    'POS-1004',
    daysAgo(9, 11, 15),
    [
      orderItem('Chocolate Custard', 2, 480000, 'p_chocolate'),
      orderItem('Strawberry Tart', 2, 420000, 'p_strawberry'),
    ],
    'cash',
    'c_demo_ind',
  );

  posOrder(
    'ord_pos_1005',
    'POS-1005',
    daysAgo(5, 16, 10),
    [orderItem('Cream Puffs', 6, 380000, 'p_creampuff')],
    'pos',
    'c_brightline',
  );

  posOrder(
    'ord_pos_1006',
    'POS-1006',
    daysAgo(2, 12, 30),
    [orderItem('Vanilla Custard', 1, 450000, 'p_vanilla'), orderItem('Mocha', 2, 500000, 'p_mocha')],
    'cash',
  );

  posOrder(
    'ord_pos_1007',
    'POS-1007',
    daysAgo(0, 9, 20),
    [orderItem('Mocha', 2, 500000, 'p_mocha'), orderItem('Cream Puffs', 1, 380000, 'p_creampuff')],
    'pos',
    'c_walkin',
  );

  makeOrder({
    id: 'ord_custom_2001',
    code: 'ORD-2001',
    type: 'organizational',
    status: 'in_production',
    source: 'bms',
    customerId: 'c_brightline',
    items: [
      orderItem('Three-tier botanical celebration cake', 1, 18000000),
      orderItem('Cake box (large) — presentation packaging', 1, 0),
    ],
    location: 'home_bakery',
    deliveryLocation: 'home_bakery',
    deliveryDate: dayOffset(5),
    notes:
      'Demo quotation. Deposit received; balance due on delivery. Customer requested botanical palette.',
    at: daysAgo(10, 10, 0),
  });

  makePayment({
    orderId: 'ord_custom_2001',
    customerId: 'c_brightline',
    kind: 'payment',
    role: 'deposit',
    method: 'transfer',
    amountCents: 9000000,
    location: 'home_bakery',
    note: 'Deposit (demo)',
    createdAt: daysAgo(8, 10, 0),
  });

  makeOrder({
    id: 'ord_bulk_2003',
    code: 'ORD-2003',
    type: 'bulk',
    status: 'confirmed',
    source: 'bms',
    customerId: 'c_brightline',
    items: [orderItem('Cream Puffs — box of six', 20, 380000, 'p_creampuff')],
    location: 'home_bakery',
    deliveryLocation: 'cafe',
    deliveryDate: dayOffset(3),
    notes: 'Demo bulk order for an office event.',
    at: daysAgo(6, 9, 0),
  });

  makePayment({
    orderId: 'ord_bulk_2003',
    customerId: 'c_brightline',
    kind: 'payment',
    role: 'deposit',
    method: 'transfer',
    amountCents: 3000000,
    location: 'home_bakery',
    note: 'Deposit (demo)',
    createdAt: daysAgo(5, 9, 0),
  });

  makeOrder({
    id: 'ord_inquiry_3001',
    code: 'INQ-3001',
    type: 'custom',
    status: 'inquiry',
    source: 'website',
    customerId: 'c_website',
    items: [orderItem('Anniversary cake for 40 guests', 1, 0)],
    location: 'home_bakery',
    deliveryDate: dayOffset(18),
    notes: 'Website inquiry (demo). Prefers vanilla and berries. Awaiting quotation.',
    at: daysAgo(1, 16, 20),
  });

  // Historic transfer: completed movement pairs keep the ledger consistent.
  move('fin_creampuff', 'home_bakery', -6, 'transfer_out', daysAgo(4, 8, 0), 'trf_6001', 'Transfer TRF-6001');
  move('fin_creampuff', 'cafe', 6, 'transfer_in', daysAgo(4, 11, 0), 'trf_6001', 'Transfer TRF-6001');

  // Received demo purchase order.
  move('ing_butter', 'home_bakery', 20, 'purchase_receipt', daysAgo(3, 9, 30), 'po_5002', 'PO-5002 receipt');
  move('ing_cream', 'home_bakery', 15, 'purchase_receipt', daysAgo(3, 9, 30), 'po_5002', 'PO-5002 receipt');

  const stockMap = new Map<string, number>();
  movements.forEach((mv) => {
    const key = `${mv.itemId}::${mv.location}`;
    stockMap.set(key, (stockMap.get(key) ?? 0) + mv.quantityDelta);
  });
  const stock: StockLevel[] = Array.from(stockMap.entries())
    .map(([key, quantity]) => {
      const [itemId, location] = key.split('::');
      return { itemId, location: location as StockLevel['location'], quantity: Number(quantity.toFixed(3)) };
    })
    .filter((row) => row.quantity !== 0);

  const recipes = [
    {
      id: 'r_vanilla',
      productId: 'p_vanilla',
      yieldQuantity: 8,
      lines: [
        { itemId: 'ing_milk', quantity: 2 },
        { itemId: 'ing_cream', quantity: 1 },
        { itemId: 'ing_sugar', quantity: 0.6 },
        { itemId: 'ing_eggs', quantity: 12 },
        { itemId: 'ing_vanilla', quantity: 0.05 },
        { itemId: 'pkg_tartbox', quantity: 8 },
      ],
      notes: 'Demo recipe. Custard set in tart shells, eight per batch.',
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_chocolate',
      productId: 'p_chocolate',
      yieldQuantity: 8,
      lines: [
        { itemId: 'ing_milk', quantity: 2 },
        { itemId: 'ing_cream', quantity: 1 },
        { itemId: 'ing_sugar', quantity: 0.5 },
        { itemId: 'ing_eggs', quantity: 12 },
        { itemId: 'ing_chocolate', quantity: 0.8 },
        { itemId: 'ing_cocoa', quantity: 0.1 },
        { itemId: 'pkg_tartbox', quantity: 8 },
      ],
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_mocha',
      productId: 'p_mocha',
      yieldQuantity: 8,
      lines: [
        { itemId: 'ing_milk', quantity: 2 },
        { itemId: 'ing_cream', quantity: 1 },
        { itemId: 'ing_sugar', quantity: 0.5 },
        { itemId: 'ing_eggs', quantity: 12 },
        { itemId: 'ing_coffee', quantity: 0.08 },
        { itemId: 'ing_cocoa', quantity: 0.12 },
        { itemId: 'pkg_tartbox', quantity: 8 },
      ],
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_mille',
      productId: 'p_mille',
      yieldQuantity: 4,
      lines: [
        { itemId: 'ing_puff', quantity: 1.5 },
        { itemId: 'ing_cream', quantity: 1 },
        { itemId: 'ing_sugar', quantity: 0.4 },
        { itemId: 'ing_milk', quantity: 0.5 },
        { itemId: 'pkg_cakebox', quantity: 4 },
      ],
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_creampuff',
      productId: 'p_creampuff',
      yieldQuantity: 6,
      lines: [
        { itemId: 'ing_puff', quantity: 1 },
        { itemId: 'ing_cream', quantity: 1.2 },
        { itemId: 'ing_eggs', quantity: 6 },
        { itemId: 'ing_sugar', quantity: 0.3 },
        { itemId: 'pkg_tartbox', quantity: 6 },
      ],
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_strawberry',
      productId: 'p_strawberry',
      yieldQuantity: 6,
      lines: [
        { itemId: 'ing_puff', quantity: 0.8 },
        { itemId: 'ing_cream', quantity: 0.8 },
        { itemId: 'ing_strawberry', quantity: 1.2 },
        { itemId: 'ing_sugar', quantity: 0.2 },
        { itemId: 'pkg_tartbox', quantity: 6 },
      ],
      updatedAt: daysAgo(20),
    },
    {
      id: 'r_choc_tart',
      productId: 'p_choc_tart',
      yieldQuantity: 6,
      lines: [
        { itemId: 'ing_puff', quantity: 0.8 },
        { itemId: 'ing_chocolate', quantity: 0.9 },
        { itemId: 'ing_cream', quantity: 0.7 },
        { itemId: 'pkg_tartbox', quantity: 6 },
      ],
      updatedAt: daysAgo(20),
    },
  ];

  return {
    version: 1,
    products,
    customers,
    orders,
    payments,
    inventoryItems,
    stock,
    movements,
    suppliers: [
      {
        id: 'sup_aurora',
        name: 'Aurora Milling (demo)',
        contactName: 'Orders desk',
        notes: 'Demo supplier record.',
        createdAt: daysAgo(25),
      },
      {
        id: 'sup_greenvalley',
        name: 'Green Valley Demo Supplies',
        contactName: 'Trade counter',
        notes: 'Demo dairy and produce supplier.',
        createdAt: daysAgo(24),
      },
    ],
    purchaseOrders: [
      {
        id: 'po_5001',
        code: 'PO-5001',
        supplierId: 'sup_aurora',
        status: 'ordered',
        lines: [
          { itemId: 'ing_flour', quantity: 50, unitCostCents: 115000 },
          { itemId: 'ing_sugar', quantity: 30, unitCostCents: 145000 },
        ],
        expectedAt: dayOffset(3),
        notes: 'Demo purchase order. Stock is only added when goods are received.',
        createdAt: daysAgo(2),
      },
      {
        id: 'po_5002',
        code: 'PO-5002',
        supplierId: 'sup_greenvalley',
        status: 'received',
        lines: [
          { itemId: 'ing_butter', quantity: 20, unitCostCents: 320000 },
          { itemId: 'ing_cream', quantity: 15, unitCostCents: 450000 },
        ],
        notes: 'Demo purchase order, fully received.',
        createdAt: daysAgo(5),
      },
    ],
    purchaseReceipts: [
      {
        id: 'rcp_5002',
        purchaseOrderId: 'po_5002',
        supplierId: 'sup_greenvalley',
        location: 'home_bakery',
        lines: [
          { itemId: 'ing_butter', quantity: 20, unitCostCents: 320000 },
          { itemId: 'ing_cream', quantity: 15, unitCostCents: 450000 },
        ],
        receivedAt: daysAgo(3, 9, 30),
        receivedBy: 'Demo Storekeeper',
      },
    ],
    supplierPayments: [
      {
        id: 'spay_1',
        supplierId: 'sup_greenvalley',
        amountCents: 5000000,
        method: 'transfer',
        note: 'Part payment (demo)',
        createdAt: daysAgo(2),
      },
    ],
    recipes,
    batches: [
      {
        id: 'batch_7002',
        code: 'BATCH-7002',
        title: 'Three-tier botanical celebration cake',
        orderId: 'ord_custom_2001',
        quantity: 1,
        location: 'home_bakery',
        status: 'in_production',
        assignedEmployeeId: 'emp_baker',
        scheduledFor: isoToday(),
        startedAt: daysAgo(0, 8, 0),
        notes: 'Custom cake for Brightline Demo Ltd. No recipe attached (custom specification).',
        createdAt: daysAgo(3),
      },
      {
        id: 'batch_7003',
        code: 'BATCH-7003',
        title: 'Vanilla Custard — batch',
        productId: 'p_vanilla',
        recipeId: 'r_vanilla',
        quantity: 8,
        location: 'home_bakery',
        status: 'scheduled',
        assignedEmployeeId: 'emp_baker',
        scheduledFor: dayOffset(1),
        createdAt: daysAgo(0, 7, 30),
      },
    ],
    transfers: [
      {
        id: 'trf_6001',
        code: 'TRF-6001',
        from: 'home_bakery',
        to: 'cafe',
        lines: [{ itemId: 'fin_creampuff', quantity: 6 }],
        status: 'received',
        notes: 'Demo completed transfer.',
        createdAt: daysAgo(4, 7, 30),
        dispatchedAt: daysAgo(4, 8, 0),
        receivedAt: daysAgo(4, 11, 0),
      },
      {
        id: 'trf_6002',
        code: 'TRF-6002',
        from: 'home_bakery',
        to: 'cafe',
        lines: [{ itemId: 'ing_strawberry', quantity: 4 }],
        status: 'requested',
        notes: 'Demo pending transfer request.',
        createdAt: daysAgo(0, 10, 0),
      },
    ],
    expenses: [
      {
        id: 'exp_1',
        category: 'utilities',
        amountCents: 7500000,
        location: 'home_bakery',
        note: 'Demo utilities expense',
        incurredAt: daysAgo(10),
        recordedBy: 'Demo Owner',
      },
      {
        id: 'exp_2',
        category: 'packaging',
        amountCents: 4200000,
        location: 'cafe',
        note: 'Demo packaging restock',
        incurredAt: daysAgo(7),
        recordedBy: 'Demo Manager',
      },
      {
        id: 'exp_3',
        category: 'marketing',
        amountCents: 2500000,
        location: 'cafe',
        note: 'Demo seasonal print campaign',
        incurredAt: daysAgo(3),
        recordedBy: 'Demo Manager',
      },
    ],
    employees: [
      {
        id: 'emp_owner',
        name: 'Demo Owner',
        email: 'owner@seasonscake.demo',
        password: 'seasoncake',
        role: 'owner',
        isActive: true,
        createdAt: OPENED,
      },
      {
        id: 'emp_admin',
        name: 'Demo Administrator',
        email: 'admin@seasonscake.demo',
        password: 'seasoncake',
        role: 'admin',
        isActive: true,
        createdAt: OPENED,
      },
      {
        id: 'emp_manager',
        name: 'Demo Manager',
        email: 'manager@seasonscake.demo',
        password: 'seasoncake',
        role: 'manager',
        isActive: true,
        createdAt: OPENED,
      },
      {
        id: 'emp_cashier',
        name: 'Demo Cashier',
        email: 'cashier@seasonscake.demo',
        password: 'seasoncake',
        role: 'cashier',
        isActive: true,
        createdAt: OPENED,
      },
      {
        id: 'emp_baker',
        name: 'Demo Baker',
        email: 'production@seasonscake.demo',
        password: 'seasoncake',
        role: 'production',
        isActive: true,
        createdAt: OPENED,
      },
      {
        id: 'emp_store',
        name: 'Demo Storekeeper',
        email: 'inventory@seasonscake.demo',
        password: 'seasoncake',
        role: 'inventory',
        isActive: true,
        createdAt: OPENED,
      },
    ],
    messages: [
      {
        id: 'msg_1',
        name: 'Demo Website Visitor',
        email: 'visitor@seasonscake.demo',
        phone: '000 000 0002',
        subject: 'Event enquiry',
        body: 'Hello — I would like to discuss a cake for an office event. Could someone share the custom order process? (demo message)',
        isRead: false,
        createdAt: daysAgo(1, 16, 25),
      },
    ],
    siteContent: {
      heroEyebrow: 'Botanical patisserie',
      heroTitle: 'Baked with the seasons',
      heroLead:
        'Custards, mille-feuille and tarts made fresh at our home bakery — served at the counter and finished by hand.',
      aboutTitle: 'A bakery built around freshness',
      aboutLead:
        'Seasons Cake is a botanical patisserie working from a home bakery, with a café counter for the everyday bake.',
      aboutBody:
        'Our catalogue stays deliberately small: seven bakes we can make well, every single day. Fruit follows the season, cream is whipped to order, and pastry is baked in small batches. For celebrations, corporate gifting and larger gatherings we take custom and organisational orders with a written quotation.',
      customOrderNote:
        'Share the occasion, headcount and any style references. We will respond with availability and a written quotation; no payment is taken through this form.',
      contactPhone: '',
      contactEmail: '',
      contactAddress: '',
      openingHours: '',
      galleryCaptions: [
        'Counter bake — demo caption',
        'Botanical palette — demo caption',
        'Custard finish — demo caption',
        'Pastry layers — demo caption',
        'Celebration cake — demo caption',
        'Seasonal fruit — demo caption',
      ],
    },
    settings: {
      businessName: 'Seasons Cake',
      currency: 'NGN',
      tagline: 'Delicious & Fresh',
      locations: [
        { id: 'home_bakery', name: 'Home Bakery', kind: 'Production & collection' },
        { id: 'cafe', name: 'Café', kind: 'Retail counter' },
      ],
    },
    activity: [
      {
        id: 'act_1',
        message: 'Demo data initialised with catalogue, ledgers and opening stock.',
        actor: 'System',
        createdAt: OPENED,
      },
      {
        id: 'act_2',
        message: 'Deposit of ₦90,000 recorded for ORD-2001 (financial event only — no stock movement).',
        actor: 'Demo Manager',
        createdAt: daysAgo(8, 10, 0),
      },
      {
        id: 'act_3',
        message: 'Production batch BATCH-7002 started for Brightline Demo Ltd.',
        actor: 'Demo Baker',
        createdAt: daysAgo(0, 8, 0),
      },
    ],
    counters: {
      pos: 1007,
      order: 2003,
      inquiry: 3001,
      po: 5002,
      batch: 7003,
      transfer: 6002,
    },
  };
}

function isoToday(): string {
  return nowIso().slice(0, 10);
}
