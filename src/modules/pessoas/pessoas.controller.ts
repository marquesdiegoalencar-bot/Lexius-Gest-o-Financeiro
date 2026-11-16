import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreatePessoaDto } from './dto/create-pessoa.dto';
import { UpdatePessoaDto } from './dto/update-pessoa.dto';
import { PessoasService } from './pessoas.service';

@Controller('pessoas')
@UseGuards(PapelGuard)
export class PessoasController {
  constructor(private service: PessoasService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Query('q') q?: string, @Query('documento') documento?: string) {
    return this.service.findAll(q, documento);
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
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO, PapelUsuario.OPERADOR)
  create(@Body() dto: CreatePessoaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  update(@Param('id') id: string, @Body() dto: UpdatePessoaDto) {
    return this.service.update(id, dto);
  }
}