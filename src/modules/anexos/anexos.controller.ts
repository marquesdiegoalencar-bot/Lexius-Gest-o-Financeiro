import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { AnexosService } from './anexos.service';

type ReqAuth = { empresaId: string; user: { sub: string } };

@Controller('anexos')
@UseGuards(PapelGuard)
export class AnexosController {
  constructor(private service: AnexosService) {}

  @Post()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      preservePath: true,
      fileFilter: (_req, file, cb) => {
        const nome = file.originalname ?? '';
        if (nome.includes('..') || /[/\\]/.test(nome)) {
          return cb(new BadRequestException('Nome de arquivo inválido') as Error, false);
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Req() req: ReqAuth,
    @UploadedFile() file: Express.Multer.File,
    @Query('entidade') entidade: string,
    @Query('entidade_id') entidadeId: string,
  ) {
    return this.service.upload(req.empresaId, req.user.sub, entidade, entidadeId, file);
  }

  @Get(':id/download')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  download(@Param('id') id: string, @Query('token') token: string) {
    return this.service.download(id, token);
  }
}