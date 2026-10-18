import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ZohoController } from './zoho.controller';

// Garante que as regras de acesso não sejam removidas por engano:
// ver o calendário = qualquer usuário logado; alterar = só ADMIN.
describe('ZohoController access rules', () => {
  const rolesOf = (handler: unknown) =>
    Reflect.getMetadata(ROLES_KEY, handler as object);

  it('lets any logged user read events', () => {
    expect(rolesOf(ZohoController.prototype.getEvents)).toBeUndefined();
  });

  it.each(['createEvent', 'updateEvent', 'deleteEvent'] as const)(
    '%s is ADMIN only',
    (method) => {
      expect(rolesOf(ZohoController.prototype[method])).toEqual(['ADMIN']);
    },
  );
});
