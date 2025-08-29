import { DataTypes, Model, Sequelize } from 'sequelize';

export class Instance extends Model {
    public id!: number;
    public port!: number;
    public workspace_path!: string;
    public workspace_name!: string;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export class Credential extends Model {
    public id!: number;
    public instance_id!: number;
    public ciphertext!: Buffer;
    public salt!: Buffer;
    public iv!: Buffer;
    public expires_at!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export function initializeModels(sequelize: Sequelize): void {
    Instance.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        port: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
        },
        workspace_path: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        workspace_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        tableName: 'instances',
        timestamps: true,
    });

    Credential.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        instance_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: Instance,
                key: 'id',
            },
        },
        ciphertext: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
        salt: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
        iv: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
        expires_at: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        sequelize,
        tableName: 'credentials',
        timestamps: true,
    });

    Instance.hasMany(Credential, {
        foreignKey: 'instance_id',
        as: 'credentials',
    });

    Credential.belongsTo(Instance, {
        foreignKey: 'instance_id',
        as: 'instance',
    });
}