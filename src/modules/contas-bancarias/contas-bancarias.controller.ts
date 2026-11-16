import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { ContasBancariasService } from './contas-bancarias.service';
import { CreateContaBancariaDto } from './dto/create-conta-bancaria.dto';
import { UpdateContaBancariaDto } from './dto/update-conta-bancaria.dto';

@Controller('contas-bancarias')
@UseGuards(PapelGuard)
export class ContasBancariasController {
  constructor(private service: ContasBancariasService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: { empresaId: string }) {
    return this.service.list(req.empresaId);
  }

  @Get(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  get(@Param('id') id: string, @Req() req: { empresaId: string }) {
    return this.service.findOne(id, req.empresaId);
  }

  @Post()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  create(@Req() req: { empresaId: string }, @Body() dto: CreateContaBancariaDto) {
    return this.service.create(req.empresaId, dto);
  }

  @Patch(':id')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  update(@Param('id') id: string, @Req() req: { empresaId: string }, @Body() dto: UpdateContaBancariaDto) {
    return this.service.update(id, req.empresaId, dto);
  }
}