import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';
import { Repository } from 'typeorm';
import { STORAGE_PROVIDER, StorageProvider } from '../../common/storage/storage-provider.interface';
import { Anexo } from '../../database/entities/anexo.entity';

const ENTIDADES = new Set([
  'baixa',
  'pagamento_bancario',
  'titulo_pagar',
  'titulo_receber',
  'repasse',
]);

@Injectable()
export class AnexosService {
  private readonly maxBytes: number;
  private readonly allowedMime: Set<string>;

  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    @InjectRepository(Anexo) private repo: Repository<Anexo>,
  ) {
    this.maxBytes = Number(this.config.get<string>('ANEXO_MAX_BYTES') ?? 10 * 1024 * 1024);
    const raw = this.config.get<string>('ANEXO_MIME_ALLOWED') ?? 'application/pdf,image/png,image/jpeg';
    this.allowedMime = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }

  async upload(
    empresaId: string,
    usuarioId: string,
    entidade: string,
    entidadeId: string,
    file: Express.Multer.File,
  ) {
    if (!ENTIDADES.has(entidade)) {
      throw new BadRequestException('entidade inválida');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException('Arquivo excede tamanho máximo');
    }
    if (!this.allowedMime.has(file.mimetype)) {
      throw new BadRequestException('Tipo MIME não permitido');
    }

    const nomeArquivo = this.validarNomeArquivo(file.originalname);

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const ext = path.extname(nomeArquivo) || '';
    const storageKey = path.join(empresaId, `${randomUUID()}${ext}`).replace(/\\/g, '/');
    await this.storage.save({
      relativeKey: storageKey,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const anexo = await this.repo.save(
      this.repo.create({
        empresaId,
        entidade,
        entidadeId,
        nomeArquivo,
        mimeType: file.mimetype,
        tamanhoBytes: String(file.size),
        hashSha256: hash,
        storageChave: storageKey,
        enviadoPor: usuarioId,
      }),
    );

    const token = await this.jwt.signAsync(
      { typ: 'anexo', aid: anexo.id, eid: empresaId },
      { expiresIn: '5m' },
    );

    return { anexo, download_token: token };
  }

  private validarNomeArquivo(originalname: string): string {
    if (!originalname?.trim()) {
      throw new BadRequestException('Nome de arquivo inválido');
    }
    if (originalname.includes('..') || originalname.includes('/') || originalname.includes('\\')) {
      throw new BadRequestException('Nome de arquivo inválido');
    }
    const base = path.basename(originalname);
    if (base !== originalname || base === '.' || base === '..') {
      throw new BadRequestException('Nome de arquivo inválido');
    }
    return base;
  }

  async download(anexoId: string, token: string) {
    let payload: { typ?: string; aid?: string; eid?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new BadRequestException('Token inválido ou expirado');
    }
    if (payload.typ !== 'anexo' || payload.aid !== anexoId) {
      throw new BadRequestException('Token não corresponde ao anexo');
    }

    const anexo = await this.repo.findOne({ where: { id: anexoId, empresaId: payload.eid } });
    if (!anexo) throw new NotFoundException('Anexo não encontrado');

    const buffer = await this.storage.read(anexo.storageChave);
    return new StreamableFile(buffer, {
      type: anexo.mimeType,
      disposition: `attachment; filename="${anexo.nomeArquivo}"`,
    });
  }
}