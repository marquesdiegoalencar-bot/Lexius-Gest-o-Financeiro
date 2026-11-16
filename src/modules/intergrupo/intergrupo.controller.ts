import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateIntergrupoDto } from './dto/create-intergrupo.dto';
import { IntergrupoService } from './intergrupo.service';

type ReqAuth = { user: { sub: string } };

@Controller('intergrupo')
@UseGuards(PapelGuard)
export class IntergrupoController {
  constructor(private service: IntergrupoService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.CONSULTA,
  )
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  create(@Req() req: ReqAuth, @Body() dto: CreateIntergrupoDto) {
    return this.service.create(req.user.sub, dto);
  }
}