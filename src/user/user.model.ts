import { Column, Model, Table, HasMany } from 'sequelize-typescript';
import { Request } from '../request/request.model';

@Table({ tableName: 'users' })
export class User extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({ unique: true, allowNull: false })
  declare email: string;

  @Column({ allowNull: false })
  declare password: string;

  @Column
  declare name: string;

  @Column({ defaultValue: 'user' })
  declare role: 'user' | 'moderator';

  @HasMany(() => Request)
  declare requests: Request[];
}