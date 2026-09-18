-- foto_perfil_url: cualquier rol puede tener una foto de perfil.
-- nombre_publico: el nombre que vera el comprador final en la ficha de
-- trazabilidad publica -- relevante sobre todo para Productor (puede
-- preferir mostrar un nombre distinto al de su cuenta de login), pero se
-- deja disponible para cualquier rol en vez de restringirlo por columna,
-- ya que no cuesta nada tenerlo y evita una migracion futura si otro rol
-- lo llega a necesitar.
ALTER TABLE usuarios ADD COLUMN foto_perfil_url TEXT;
ALTER TABLE usuarios ADD COLUMN nombre_publico TEXT;
