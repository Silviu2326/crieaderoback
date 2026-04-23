import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Directorio para subir documentos
const UPLOAD_DIR = path.join(__dirname, '../../uploads/documents');

// Asegurar que el directorio existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// List documents
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, type, dogId, customerId, search, status } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (type) where.type = type as string;
  if (dogId) where.dogId = dogId as string;
  if (customerId) where.customerId = customerId as string;
  if (status) where.status = status as string;

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { tags: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Access control
  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    const myKennelIds = myKennels.map(k => k.id);

    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: myKennelIds };
    }
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });

    const assignedKennelIds = vet?.kennels.map(k => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: assignedKennelIds };
    }
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      kennel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ documents });
});

// Get single document
export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      dog: {
        include: {
          breed: { select: { name: true } },
          father: { select: { name: true } },
          mother: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
        },
      },
      kennel: {
        select: {
          id: true,
          name: true,
          breederId: true,
          address: true,
          city: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && document.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ document });
});

// Upload document
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    name,
    type,
    description,
    dogId,
    customerId,
    kennelId,
    tags,
    issuedDate,
    expiryDate,
  } = req.body;

  // Check access to kennel
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Handle file upload
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Save file
  fs.writeFileSync(filePath, file.buffer);

  // Create document record
  const document = await prisma.document.create({
    data: {
      name: name || file.originalname,
      type: type || 'OTHER',
      description,
      url: `/uploads/documents/${fileName}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      kennelId,
      dogId,
      customerId,
      tags,
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      uploadedBy: user.id,
    },
    include: {
      dog: {
        select: { id: true, name: true },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  res.status(201).json({ document });
});

// Generate contract
export const generateContract = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    kennelId,
    customerId,
    dogId,
    contractType,
    price,
    deposit,
    terms,
    templateId,
  } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Get template if specified
  let templateContent = '';
  if (templateId) {
    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    if (template) {
      templateContent = template.content;
    }
  }

  // Get related data
  const [kennel, customer, dog] = await Promise.all([
    prisma.kennel.findUnique({
      where: { id: kennelId },
      include: { breeder: { select: { firstName: true, lastName: true } } },
    }),
    customerId ? prisma.customer.findUnique({ where: { id: customerId } }) : null,
    dogId ? prisma.dog.findUnique({
      where: { id: dogId },
      include: { breed: { select: { name: true } } },
    }) : null,
  ]);

  // Generate contract content
  const contractData = {
    date: new Date().toLocaleDateString('es-ES'),
    kennelName: kennel?.name || '',
    breederName: kennel?.breeder ? `${kennel.breeder.firstName} ${kennel.breeder.lastName}` : '',
    kennelAddress: kennel?.address || '',
    kennelCity: kennel?.city || '',
    kennelPhone: kennel?.phone || '',
    kennelEmail: kennel?.email || '',
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : '',
    customerAddress: customer?.address || '',
    customerCity: customer?.city || '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    dogName: dog?.name || '',
    dogBreed: dog?.breed?.name || '',
    dogColor: dog?.color || '',
    dogBirthDate: dog?.birthDate ? new Date(dog.birthDate).toLocaleDateString('es-ES') : '',
    dogMicrochip: dog?.microchip || '',
    price: price || 0,
    deposit: deposit || 0,
    terms: terms || '',
  };

  // Replace template variables
  let contractContent = templateContent || getDefaultContractTemplate();
  Object.entries(contractData).forEach(([key, value]) => {
    contractContent = contractContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  // Generate PDF or save as HTML
  const fileName = `contract_${Date.now()}.html`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(filePath, contractContent);

  // Create document record
  const document = await prisma.document.create({
    data: {
      name: `Contrato - ${customer ? `${customer.firstName} ${customer.lastName}` : 'Sin cliente'}`,
      type: 'CONTRACT',
      description: `Contrato de ${contractType || 'venta'}`,
      url: `/uploads/documents/${fileName}`,
      fileName,
      fileSize: fs.statSync(filePath).size,
      mimeType: 'text/html',
      kennelId,
      dogId,
      customerId,
      contractData: JSON.stringify(contractData),
      uploadedBy: user.id,
    },
    include: {
      dog: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ document, contractContent });
});

// Generate pedigree certificate
export const generatePedigree = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, kennelId } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Get dog with full pedigree info
  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: {
      breed: true,
      father: {
        include: {
          breed: { select: { name: true } },
          father: { select: { name: true } },
          mother: { select: { name: true } },
        },
      },
      mother: {
        include: {
          breed: { select: { name: true } },
          father: { select: { name: true } },
          mother: { select: { name: true } },
        },
      },
      kennel: true,
    },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  // Generate pedigree HTML
  const pedigreeContent = generatePedigreeHTML(dog);

  // Save file
  const fileName = `pedigree_${dog.name}_${Date.now()}.html`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(filePath, pedigreeContent);

  // Create document record
  const document = await prisma.document.create({
    data: {
      name: `Pedigree - ${dog.name}`,
      type: 'PEDIGREE',
      description: `Certificado de pedigree de ${dog.name}`,
      url: `/uploads/documents/${fileName}`,
      fileName,
      fileSize: fs.statSync(filePath).size,
      mimeType: 'text/html',
      kennelId,
      dogId,
      fatherDogId: dog.fatherId || undefined,
      motherDogId: dog.motherId || undefined,
      metadata: JSON.stringify({
        dogName: dog.name,
        breed: dog.breed?.name,
        birthDate: dog.birthDate,
        microchip: dog.microchip,
        father: dog.father?.name,
        mother: dog.mother?.name,
      }),
      uploadedBy: user.id,
    },
    include: {
      dog: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ document, pedigreeContent });
});

// Update document
export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { name, description, tags, status, isPublic } = req.body;

  const document = await prisma.document.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Check access
  if (user.role === 'BREEDER' && document.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {};
  if (name) data.name = name;
  if (description !== undefined) data.description = description;
  if (tags !== undefined) data.tags = tags;
  if (status) data.status = status;
  if (isPublic !== undefined) data.isPublic = isPublic;

  const updatedDocument = await prisma.document.update({
    where: { id },
    data,
    include: {
      dog: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.json({ document: updatedDocument });
});

// Delete document
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const document = await prisma.document.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (user.role === 'BREEDER' && document.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Delete physical file
  const filePath = path.join(__dirname, '../..', document.url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.document.delete({ where: { id } });

  res.json({ message: 'Document deleted successfully' });
});

// Download document
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const document = await prisma.document.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && document.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const filePath = path.join(__dirname, '../..', document.url);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${document.fileName || document.name}"`);
  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// ==================== TEMPLATES ====================

// List templates
export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, type } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) {
    if (user.role === 'BREEDER') {
      const kennel = await prisma.kennel.findUnique({
        where: { id: kennelId as string },
      });
      if (!kennel || kennel.breederId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    where.kennelId = kennelId as string;
  }

  if (type) where.type = type as string;

  const templates = await prisma.documentTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ templates });
});

// Create template
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { name, type, content, variables, kennelId } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const template = await prisma.documentTemplate.create({
    data: {
      name,
      type,
      content,
      variables,
      kennelId,
    },
  });

  res.status(201).json({ template });
});

// Update template
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { name, content, variables, isActive } = req.body;

  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  if (user.role === 'BREEDER' && template.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {};
  if (name) data.name = name;
  if (content) data.content = content;
  if (variables !== undefined) data.variables = variables;
  if (isActive !== undefined) data.isActive = isActive;

  const updatedTemplate = await prisma.documentTemplate.update({
    where: { id },
    data,
  });

  res.json({ template: updatedTemplate });
});

// Delete template
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  if (user.role === 'BREEDER' && template.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.documentTemplate.delete({ where: { id } });

  res.json({ message: 'Template deleted successfully' });
});

// Helper functions
function getDefaultContractTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contrato de Venta</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { text-align: center; color: #333; }
    .section { margin: 20px 0; }
    .signature { margin-top: 60px; display: flex; justify-content: space-between; }
    .signature-line { border-top: 1px solid #333; width: 250px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>CONTRATO DE VENTA DE CACHORRO</h1>

  <div class="section">
    <h2>Datos del Vendedor</h2>
    <p><strong>Criadero:</strong> {{kennelName}}</p>
    <p><strong>Vendedor:</strong> {{breederName}}</p>
    <p><strong>Dirección:</strong> {{kennelAddress}}, {{kennelCity}}</p>
    <p><strong>Teléfono:</strong> {{kennelPhone}}</p>
    <p><strong>Email:</strong> {{kennelEmail}}</p>
  </div>

  <div class="section">
    <h2>Datos del Comprador</h2>
    <p><strong>Nombre:</strong> {{customerName}}</p>
    <p><strong>Dirección:</strong> {{customerAddress}}, {{customerCity}}</p>
    <p><strong>Teléfono:</strong> {{customerPhone}}</p>
    <p><strong>Email:</strong> {{customerEmail}}</p>
  </div>

  <div class="section">
    <h2>Datos del Cachorro</h2>
    <p><strong>Nombre:</strong> {{dogName}}</p>
    <p><strong>Raza:</strong> {{dogBreed}}</p>
    <p><strong>Color:</strong> {{dogColor}}</p>
    <p><strong>Fecha de Nacimiento:</strong> {{dogBirthDate}}</p>
    <p><strong>Microchip:</strong> {{dogMicrochip}}</p>
  </div>

  <div class="section">
    <h2>Términos del Contrato</h2>
    <p><strong>Precio:</strong> €{{price}}</p>
    <p><strong>Señal/Depósito:</strong> €{{deposit}}</p>
    <p><strong>Términos adicionales:</strong></p>
    <p>{{terms}}</p>
  </div>

  <p>Fecha: {{date}}</p>

  <div class="signature">
    <div>
      <div class="signature-line"></div>
      <p>Firma del Vendedor</p>
    </div>
    <div>
      <div class="signature-line"></div>
      <p>Firma del Comprador</p>
    </div>
  </div>
</body>
</html>`;
}

function generatePedigreeHTML(dog: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificado de Pedigree - ${dog.name}</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
      background: linear-gradient(135deg, #f5f5f5 0%, #fff 100%);
    }
    .certificate {
      border: 8px double #8b4513;
      padding: 40px;
      background: #fff;
    }
    h1 {
      text-align: center;
      color: #8b4513;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
    }
    .pedigree-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .pedigree-table td {
      border: 1px solid #8b4513;
      padding: 10px;
      vertical-align: top;
    }
    .dog-name {
      font-size: 1.5em;
      font-weight: bold;
      color: #333;
    }
    .label {
      font-weight: bold;
      color: #8b4513;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <h1>🐕 CERTIFICADO DE PEDIGREE 🐕</h1>
    <p class="subtitle">${dog.kennel?.name || ''}</p>

    <div style="text-align: center; margin: 30px 0;">
      <span class="dog-name">${dog.name}</span>
    </div>

    <table class="pedigree-table">
      <tr>
        <td colspan="4" style="text-align: center; background: #f9f9f9;">
          <span class="label">DATOS DEL PERRO</span>
        </td>
      </tr>
      <tr>
        <td><span class="label">Raza:</span></td>
        <td>${dog.breed?.name || 'No especificada'}</td>
        <td><span class="label">Color:</span></td>
        <td>${dog.color || 'No especificado'}</td>
      </tr>
      <tr>
        <td><span class="label">Fecha de Nacimiento:</span></td>
        <td>${dog.birthDate ? new Date(dog.birthDate).toLocaleDateString('es-ES') : '-'}</td>
        <td><span class="label">Microchip:</span></td>
        <td>${dog.microchip || '-'}</td>
      </tr>

      <tr>
        <td colspan="4" style="text-align: center; background: #f9f9f9;">
          <span class="label">PEDIGREE - GENERACIÓN 1</span>
        </td>
      </tr>
      <tr>
        <td><span class="label">Padre:</span></td>
        <td colspan="3">${dog.father?.name || 'No registrado'} ${dog.father?.breed?.name ? `(${dog.father.breed.name})` : ''}</td>
      </tr>
      <tr>
        <td><span class="label">Madre:</span></td>
        <td colspan="3">${dog.mother?.name || 'No registrada'} ${dog.mother?.breed?.name ? `(${dog.mother.breed.name})` : ''}</td>
      </tr>

      ${dog.father?.father?.name || dog.father?.mother?.name || dog.mother?.father?.name || dog.mother?.mother?.name ? `
      <tr>
        <td colspan="4" style="text-align: center; background: #f9f9f9;">
          <span class="label">PEDIGREE - GENERACIÓN 2</span>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <span class="label">Abuelo paterno:</span> ${dog.father?.father?.name || '-'}<br>
          <span class="label">Abuela paterna:</span> ${dog.father?.mother?.name || '-'}
        </td>
        <td colspan="2">
          <span class="label">Abuelo materno:</span> ${dog.mother?.father?.name || '-'}<br>
          <span class="label">Abuela materna:</span> ${dog.mother?.mother?.name || '-'}
        </td>
      </tr>
      ` : ''}
    </table>

    <div class="footer">
      <p>Certificado generado el ${new Date().toLocaleDateString('es-ES')}</p>
      <p>Este documento certifica que la información del pedigree ha sido verificada.</p>
    </div>
  </div>
</body>
</html>`;
}
