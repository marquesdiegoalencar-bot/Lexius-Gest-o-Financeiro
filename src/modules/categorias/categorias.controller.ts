import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { Natureza, PapelUsuario } from '../../database/enums';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
@UseGuards(PapelGuard)
export class CategoriasController {
  constructor(private service: CategoriasService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: { empresaId: string }, @Query('natureza') natureza?: Natureza) {
    return this.service.list(req.empresaId, natureza);
  }

  @Get(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  create(@Body() dto: CreateCategoriaDto) {
    return this.service.create(dto);
  }
}