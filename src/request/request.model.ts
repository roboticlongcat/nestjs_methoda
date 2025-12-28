import { Column, Model, Table, ForeignKey } from 'sequelize-typescript';
import { User } from '../user/user.model';

@Table({ tableName: 'requests' })
export class Request extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column
  declare title: string;

  @Column
  declare description: string;

  @Column({ defaultValue: 'pending' })
  declare status: 'pending' | 'approved' | 'rejected';

  @ForeignKey(() => User)
  @Column
  declare authorId: number;
}