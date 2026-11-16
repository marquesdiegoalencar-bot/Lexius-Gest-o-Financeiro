import { SetMetadata } from '@nestjs/common';
import { PapelUsuario } from '../../database/enums';

export const PAPEIS_KEY = 'papeis';
export const RequirePapeis = (...papeis: PapelUsuario[]) =>
  SetMetadata(PAPEIS_KEY, papeis);