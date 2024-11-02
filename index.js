const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');
const fs = require('fs'); // fs 모듈을 불러옵니다.
const app = express();

// 날씨
const axios = require('axios');
const querystring = require('querystring');



// 뷰 엔진 및 정적 파일 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQLite 데이터베이스 설정
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
});

// 모델 정의

// Companies 모델
const Companies = sequelize.define('companies', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  trade: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // 작업 완료 여부 필드 추가
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // 기본적으로 작업 미완료
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

// Materials 모델
const Materials = sequelize.define('materials', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  materialName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  specification: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// DailyMaterials 모델 정의
const DailyMaterials = sequelize.define('daily_materials', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  materialId: {
    type: DataTypes.INTEGER,
    references: {
      model: Materials,
      key: 'id',
    },
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
  },
});

// Equipments 모델
const Equipments = sequelize.define('equipments', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  equipmentName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  specification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// WorkDetails 모델 (여기서 한 번만 선언)
const WorkDetails = sequelize.define('work_details', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  companyId: {
    type: DataTypes.INTEGER,
    references: {
      model: Companies,
      key: 'id',
    },
    allowNull: false,
  },
  personnel_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

// WorkEquipments 모델 (새로 추가)
const WorkEquipments = sequelize.define('work_equipments', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  workDetailId: {
    type: DataTypes.INTEGER,
    references: {
      model: WorkDetails,
      key: 'id',
    },
    allowNull: false,
  },
  equipmentId: {
    type: DataTypes.INTEGER,
    references: {
      model: Equipments,
      key: 'id',
    },
    allowNull: false,
  },
  equipmentCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// Weather 모델 정의
const Weather = sequelize.define('weather', {
  date: {
    type: DataTypes.DATEONLY,
    primaryKey: true,
  },
  minTemp: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  maxTemp: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  weatherCondition: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Site 모델 정의
const Site = sequelize.define('site', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  siteName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

//maxRows 수정할 수 있도록 정의
// MaxRows 모델 정의
const MaxRows = sequelize.define('max_rows', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  pageName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // 각 페이지에 대해 고유해야 함
  },
  maxRows: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50, // 기본값을 50으로 설정
  },
});



// 관계 정의
WorkDetails.belongsTo(Companies, { foreignKey: 'companyId', as: 'companyDetails' });
DailyMaterials.belongsTo(Materials, { foreignKey: 'materialId', as: 'materialDetails' , onDelete: 'CASCADE' });
Materials.hasMany(DailyMaterials, { foreignKey: 'materialId', onDelete: 'CASCADE' });

// WorkDetails와 Equipments 간 다대다 관계 설정
WorkDetails.belongsToMany(Equipments, { through: WorkEquipments, foreignKey: 'workDetailId', as: 'usedEquipments' });
Equipments.belongsToMany(WorkDetails, { through: WorkEquipments, foreignKey: 'equipmentId', as: 'workDetails' });
WorkEquipments.belongsTo(Equipments, { foreignKey: 'equipmentId', as: 'equipment' }); 

// WorkEquipments와 WorkDetails 간의 관계 정의 (이미 정의되었는지 확인)
WorkEquipments.belongsTo(WorkDetails, { foreignKey: 'workDetailId', as: 'workDetail' });

// Companies has many WorkDetails
Companies.hasMany(WorkDetails, {
  foreignKey: 'companyId',
  as: 'workDetails'
});

// 데이터베이스 초기화
(async () => {
  await sequelize.sync(); // 데이터베이스와 모델을 동기화
  console.log('All tables have been synchronized!');
})();

// 라우트 설정

// 업체 추가 페이지 라우트
app.get('/create-company', async (req, res) => {
  const companiesList = await Companies.findAll({ order: [['company', 'ASC']] });
  res.render('create-company', { companies: companiesList });
});

// 업체명 추가 처리
app.post('/create-company', async (req, res) => {
  const { company, trade } = req.body;

  await Companies.create({ company, trade });
  res.redirect('/create-company');
});

// 업체명 수정 처리
app.post('/update-company/:id', async (req, res) => {
  try {
      const { company, trade, isCompleted } = req.body;
      const companyId = req.params.id;  // URL에서 companyId를 받아옴
      
      // 체크박스 값이 'on'인 경우 true, 아니면 false로 처리
      const isCompletedValue = isCompleted === 'on' ? true : false;

      if (!companyId) {
        return res.status(400).json({ message: 'companyId가 제공되지 않았습니다.' });
      }

      await Companies.update({
        company,
        trade,
        isCompleted: isCompleted === 'on' // 체크박스가 체크되었는지 확인
      }, {
        where: { id: companyId }
      });

      res.redirect('/create-company'); // 수정 후 목록 페이지로 리다이렉트

  } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).send('Server Error');
  }
});

// 작업 완료 상태 업데이트 라우트
app.post('/update-company-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted } = req.body;

    // 해당 회사의 작업 완료 상태 업데이트
    await Companies.update(
      { isCompleted: isCompleted },
      { where: { id } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating completion status:', error);
    res.status(500).json({ success: false });
  }
});



// 업체명 삭제 처리
app.post('/delete-company/:id', async (req, res) => {
  const { id } = req.params;
  await Companies.destroy({ where: { id } });
  res.redirect('/create-company');
});



// 입력 페이지 라우트
app.get('/', async (req, res) => { 
  // 오늘의 날짜를 UTC 기준으로 가져온 후, 9시간을 더해 한국 시간으로 맞춥니다.
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 9시간 더해 KST로 변환
  const today = koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환

  // 오늘의 날씨 데이터가 있는지 확인합니다.
  const weatherExists = await Weather.findOne({ where: { date: today } });

  if (!weatherExists) {
    // 날씨 데이터가 없으면 API를 호출하여 데이터를 가져옵니다.
    await getWeatherData();
  }

  // 완료되지 않은 업체만 가져옵니다.
  const companiesList = await Companies.findAll({
    where: { isCompleted: false },  // 완료되지 않은 업체 필터링
    order: [['company', 'ASC']]     // 알파벳 순으로 정렬
  });

  const equipmentsList = await Equipments.findAll({ order: [['equipmentName', 'ASC']] });
  res.render('input', { companies: companiesList, equipments: equipmentsList, today });
});

// 공사일보 데이터 처리 라우트
app.post('/create', async (req, res) => {
  try {
    const { date, companyIds, equipmentNames, equipmentSpecifications, equipmentCounts } = req.body;

    // 업체가 선택되지 않은 경우 에러 반환
    if (!companyIds) {
      return res.status(400).send('최소 한 개의 업체를 선택해야 합니다.');
    }

    // companyIds가 단일 값일 경우 배열로 변환
    const companyIdArray = Array.isArray(companyIds) ? companyIds : [companyIds];

    // WorkDetails 생성 및 장비 데이터 처리
    for (let companyId of companyIdArray) {
      const personnel_count = req.body[`personnel_count_${companyId}`];
      const description = req.body[`description_${companyId}`];

      // 필수 입력 필드 검증
      if (!personnel_count || !description) {
        continue; // 해당 업체의 필수 입력값이 없으면 건너뜀
      }

      // 새로운 작업 세부 사항 추가
      const workDetail = await WorkDetails.create({
        date,
        companyId,
        personnel_count,
        description,
      });

      // 해당 회사에만 맞는 장비 데이터 처리
      const companyEquipmentNames = req.body[`equipmentNames_${companyId}`] || [];
      const companyEquipmentSpecifications = req.body[`equipmentSpecifications_${companyId}`] || [];
      const companyEquipmentCounts = req.body[`equipmentCounts_${companyId}`] || [];

      // 장비 연결: 장비명이 있고, 그에 따른 규격과 수량이 입력된 경우에만 연결
      for (let i = 0; i < companyEquipmentNames.length; i++) {
        const equipmentName = companyEquipmentNames[i];
        const specification = companyEquipmentSpecifications[i];
        const equipmentCount = companyEquipmentCounts[i];

        // 장비명을 기준으로 해당 장비의 ID를 찾음
        const equipment = await Equipments.findOne({
          where: {
            equipmentName: equipmentName,
            specification: specification,
          },
        });

        // 해당 장비가 있을 경우에만 WorkEquipments에 추가
        if (equipment) {
          await WorkEquipments.create({
            workDetailId: workDetail.id,
            equipmentId: equipment.id,
            equipmentCount: equipmentCount,
          });
        }
      }
    }

    // 성공적으로 데이터가 처리되면 성공 페이지로 리디렉션
    res.redirect('/success');
  } catch (error) {
    console.error('Error creating work details:', error);
    res.status(500).send('작업 세부 사항을 추가하는 중 오류가 발생했습니다.');
  }
});


// 성공 페이지 라우트
app.get('/success', (req, res) => {
  res.render('success');
});

// 관리 페이지 라우트
app.get('/manage', async (req, res) => {
  const { date, company } = req.query;
  
  // 선택된 날짜가 없으면 오늘 날짜로 설정
  const selectedDate = req.query.date || (() => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 9시간 더해 KST로 변환
    return koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환
  })();

  

  // WorkStatusFinalPaper와 ManpowerFinalPaper의 maxRows 값 불러오기
  const maxRowsWorkStatusSetting = await MaxRows.findOne({ where: { pageName: 'WorkStatusFinalPaper' } });
  const maxRowsManpowerSetting = await MaxRows.findOne({ where: { pageName: 'ManpowerFinalPaper' } });

  const maxRowsWorkStatus = maxRowsWorkStatusSetting ? maxRowsWorkStatusSetting.maxRows : 50;
  const maxRowsManpower = maxRowsManpowerSetting ? maxRowsManpowerSetting.maxRows : 88;

  // 모든 완료되지 않은 업체 리스트 가져오기
  const companiesList = await Companies.findAll({
    where: { isCompleted: false },  // 완료되지 않은 업체만 가져옴
    order: [['company', 'ASC']],
  });


  // 모든 현장명 리스트 가져오기
  let sites = [];
  try {
    sites = await Site.findAll({ order: [['siteName', 'ASC']] });
  } catch (error) {
    console.error('Error fetching sites:', error);
    // 필요하다면 에러 처리를 추가하세요.
  }

  // 조건 설정
  const whereClause = { date: selectedDate }; // 날짜 필터를 항상 적용
  if (company) {
    whereClause.companyId = company;
  }

  // 작성된 공사일보 정보와 해당 업체 정보 JOIN
  const writtenCompanies = await WorkDetails.findAll({
    where: whereClause,
    include: [
      { model: Companies, as: 'companyDetails', where: { isCompleted: false } },  // 완료되지 않은 업체만
      {
        model: Equipments,
        as: 'usedEquipments',
        through: { attributes: ['equipmentCount'] }, // 중간 테이블의 equipmentCount 가져오기
      },
    ],
    order: [['companyId', 'ASC']],
  });

  // 작성된 업체 ID 목록 추출
  const writtenCompanyIds = writtenCompanies.map((work) => work.companyId);

  // 작성되지 않은 업체 목록 구하기
  const notWrittenCompanies = await Companies.findAll({
    where: {
      id: { [Op.notIn]: writtenCompanyIds },
      isCompleted: false,  // 완료되지 않은 업체만
    },
    order: [['company', 'ASC']],
  });

  res.render('manage', {
    companies: companiesList,
    writtenCompanies,
    notWrittenCompanies,
    sites, // 추가: 현장명 리스트를 템플릿에 전달
    maxRowsWorkStatus,
    maxRowsManpower,
    selectedDate, // 선택된 날짜를 템플릿에 전달
  });
});

// 데이터베이스 초기화 라우트
app.get('/reset-database', async (req, res) => {
  try {
    // work_details 테이블만 삭제하고 다시 생성
    await WorkDetails.sync({ force: true });

    console.log('work_details table has been reset and recreated!');
    res.redirect('/manage');
  } catch (error) {
    console.error('Error resetting the work_details table:', error);
    res.status(500).send('work_details 테이블 초기화 중 오류가 발생했습니다.');
  }
});

// 수정 처리 라우트 (AJAX 요청 처리)
app.post('/update-work/:id', async (req, res) => {
  const { id } = req.params;
  const { personnel_count, description } = req.body;

  try {
    // 작업 세부사항 업데이트
    await WorkDetails.update({ personnel_count, description }, { where: { id } });

    res.status(200).json({ message: '수정 완료' });
  } catch (error) {
    console.error('Error updating work details:', error);
    res.status(500).json({ message: '수정 중 오류 발생' });
  }
});

// 삭제 처리 라우트 (AJAX 요청 처리)
app.post('/delete-work/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 작업 세부사항 삭제
    await WorkDetails.destroy({ where: { id } });

    res.status(200).json({ message: '삭제 완료' });
  } catch (error) {
    console.error('Error deleting work details:', error);
    res.status(500).json({ message: '삭제 중 오류 발생' });
  }
});

// 라우트: 자재 조회 페이지
app.get('/view-materials', async (req, res) => {
  const selectedDate = req.query.date;
  
  if (!selectedDate) {
      return res.render('view-materials', { materials: null });
  }

  try {
      // 선택한 날짜의 자재 목록을 가져옵니다.
      const materials = await DailyMaterials.findAll({
          where: { date: selectedDate },
          include: [{ model: Materials, as: 'materialDetails' }],
      });

      res.render('view-materials', { materials });
  } catch (error) {
      console.error('Error fetching materials:', error);
      res.status(500).send('자재 조회 중 오류가 발생했습니다.');
  }
});

// 라우트: 자재 수정 처리
app.post('/update-materials', async (req, res) => {
  const { materialIds, quantities } = req.body;

  if (!materialIds || !quantities) {
      return res.status(400).send('자재 ID 및 수량이 필요합니다.');
  }

  try {
      // 여러 자재의 수량을 업데이트합니다.
      for (let i = 0; i < materialIds.length; i++) {
          const materialId = materialIds[i];
          const quantity = quantities[i];

          await DailyMaterials.update(
              { quantity: quantity },
              { where: { id: materialId } }
          );
      }

      res.redirect(`/view-materials?date=${req.body.date}`);
  } catch (error) {
      console.error('Error updating materials:', error);
      res.status(500).send('자재 수정 중 오류가 발생했습니다.');
  }
});

// 라우트: 자재 삭제 처리
app.delete('/delete-material/:id', async (req, res) => {
  const materialId = req.params.id;

  try {
      // 자재 삭제
      await DailyMaterials.destroy({
          where: { id: materialId }
      });

      res.status(200).send('자재가 삭제되었습니다.');
  } catch (error) {
      console.error('Error deleting material:', error);
      res.status(500).send('자재 삭제 중 오류가 발생했습니다.');
  }
});


// 자재 관리 페이지 라우트
app.get('/manage-materials', async (req, res) => {
  const materialsList = await Materials.findAll({ order: [['materialName', 'ASC']] });
  res.render('materials', { materials: materialsList });
});

// 자재 추가 처리
app.post('/add-material', async (req, res) => {
  const { materialName, specification, unit } = req.body;

  await Materials.create({ materialName, specification, unit });
  res.redirect('/manage-materials');
});

// 자재 수정 페이지 라우트
app.get('/update-material/:id', async (req, res) => {
  const { id } = req.params;
  const material = await Materials.findByPk(id);
  res.render('update-material', { material });
});

// 자재 수정 처리
app.post('/update-material/:id', async (req, res) => {
  const { id } = req.params;
  const { materialName, specification, unit } = req.body;

  await Materials.update({ materialName, specification, unit }, { where: { id } });
  res.redirect('/manage-materials');
});

app.post('/delete-material/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // 먼저 DailyMaterials에서 해당 자재를 참조하는 데이터를 삭제
    await DailyMaterials.destroy({ where: { materialId: id } });

    // 그 후 자재 삭제
    await Materials.destroy({ where: { id } });

    res.redirect('/manage-materials');
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).send('자재 삭제 중 오류가 발생했습니다.');
  }
});

// 자재 입력 페이지 라우트
app.get('/input-materials', async (req, res) => {
  try {
    const materialsList = await Materials.findAll({
      attributes: ['materialName', 'unit'],
      group: ['materialName', 'unit'],
      order: [['materialName', 'ASC']],
    });

    const materialSpecifications = {};
    for (let material of materialsList) {
      const specifications = await Materials.findAll({
        where: { materialName: material.materialName },
        attributes: ['id', 'specification'],
        order: [[sequelize.literal("CAST(specification AS INTEGER)"), 'ASC']],
      });
      materialSpecifications[material.materialName] = specifications.map(spec => ({
        id: spec.id,
        specification: spec.specification,
      }));
    }

    res.render('input-materials', { materials: materialsList, materialSpecifications });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).send('자재 목록을 불러오는 중 오류가 발생했습니다.');
  }
});

// 자재 입력 처리 라우트
app.post('/input-materials', async (req, res) => {
  try {
    const { date, materialIds, quantities } = req.body;

    if (!materialIds || !quantities) {
      return res.status(400).send('자재와 수량을 입력해야 합니다.');
    }

    const materialIdArray = Array.isArray(materialIds) ? materialIds : [materialIds];
    const quantityArray = Array.isArray(quantities) ? quantities : [quantities];

    for (let i = 0; i < materialIdArray.length; i++) {
      const materialId = materialIdArray[i];
      const quantity = quantityArray[i];

      if (!materialId || !quantity || isNaN(quantity)) {
        return res.status(400).send('유효하지 않은 자재 또는 수량이 입력되었습니다.');
      }

      const material = await Materials.findByPk(materialId);
      if (!material) {
        return res.status(404).send(`자재 ID ${materialId}을(를) 찾을 수 없습니다.`);
      }

      await DailyMaterials.create({
        date: date,
        materialId: materialId,
        quantity: quantity,
      });
    }

    res.send("<script>alert('완료되었습니다.'); window.location.href='/input-materials';</script>");
  } catch (error) {
    console.error('Error saving material data:', error);
    res.status(500).send('자재 데이터를 저장하는 중 오류가 발생했습니다.');
  }
});

// 장비 관리 페이지 라우트
app.get('/manage-equipments', async (req, res) => {
  const equipmentsList = await Equipments.findAll();

  equipmentsList.sort((a, b) => {
    const nameA = a.equipmentName;
    const nameB = b.equipmentName;
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    const specA = parseInt(a.specification.replace(/[^0-9]/g, '')) || 0;
    const specB = parseInt(b.specification.replace(/[^0-9]/g, '')) || 0;

    return specA - specB;
  });

  res.render('manage-equipments', { equipments: equipmentsList });
});

// 장비 추가 처리
app.post('/add-equipment', async (req, res) => {
  const { equipmentName, specification } = req.body;

  await Equipments.create({ equipmentName, specification });
  res.redirect('/manage-equipments');
});

// 장비 수정 페이지 라우트
app.get('/update-equipment/:id', async (req, res) => {
  const { id } = req.params;
  const equipment = await Equipments.findByPk(id);
  res.render('update-equipment', { equipment });
});

// 장비 수정 처리
app.post('/update-equipment/:id', async (req, res) => {
  const { id } = req.params;
  const { equipmentName, specification } = req.body;

  await Equipments.update({ equipmentName, specification }, { where: { id } });
  res.redirect('/manage-equipments');
});

// 장비 삭제 처리
app.post('/delete-equipment/:id', async (req, res) => {
  const { id } = req.params;
  await Equipments.destroy({ where: { id } });
  res.redirect('/manage-equipments');
});

app.get('/ManpowerFinalPaper', async (req, res) => {
    try {
      // 선택된 날짜가 없으면 오늘 날짜로 설정
      const selectedDate = req.query.date || (() => {
        const now = new Date();
        const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 9시간 더해 KST로 변환
        return koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환
      })();
      const previousDate = new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1));
      const formattedPreviousDate = previousDate.toISOString().split('T')[0];
      
      // 데이터베이스에서 ManpowerFinalPaper의 maxRows 값 불러오기
      const maxRowsSetting = await MaxRows.findOne({ where: { pageName: 'ManpowerFinalPaper' } });
      const maxRows = maxRowsSetting ? maxRowsSetting.maxRows : 88; // 값이 없으면 기본값 88
      

      // 현장명을 데이터베이스에서 가져오기
      const site = await Site.findOne(); // 가장 첫 번째 현장명을 가져오는 예시입니다.
      const siteName = site ? site.siteName : "공사명"; // 만약 데이터가 없으면 기본값으로 "공사명" 사용

      // 날씨 데이터 가져오기
      let weatherData = await Weather.findOne({ where: { date: selectedDate } });

      if (!weatherData) {
        // 선택한 날짜가 오늘이라면, API를 호출하여 날씨 데이터를 가져옵니다.
        const today = new Date().toISOString().split('T')[0];
        if (selectedDate === today) {
          await getWeatherData();
          weatherData = await Weather.findOne({ where: { date: selectedDate } });
        } else {
          console.log(`${selectedDate}의 날씨 데이터가 없습니다.`);
        }
      }

      const weather = weatherData ? weatherData.weatherCondition : '정보 없음';
      const lowTemp = weatherData ? `${weatherData.minTemp} °C` : '정보 없음';
      const highTemp = weatherData ? `${weatherData.maxTemp} °C` : '정보 없음';


      // 모든 자재, 장비, 업체 목록을 미리 가져옵니다.
      const allMaterials = await Materials.findAll({
        order: [['id', 'ASC']]
      });

      const allEquipments = await Equipments.findAll({
        order: [['id', 'ASC']]
      });

      // 모든 업체를 가져올 때 order 필드로 정렬
      const allCompanies = await Companies.findAll({
        //where: { isCompleted: false }, // 완료되지 않은 업체만 가져오기
        order: [['order', 'ASC']], // order 필드로 정렬
        include: [{ model: WorkDetails, as: 'workDetails', where: { date: selectedDate }, required: false }]
      });

      // 선택한 날짜까지의 데이터 쿼리
      const cumulativeMaterials = await DailyMaterials.findAll({
        include: [{ model: Materials, as: 'materialDetails' }],
        where: { date: { [Op.lte]: selectedDate } },
        order: [['materialId', 'ASC']]
      });

      const cumulativeWorkDetails = await WorkDetails.findAll({
        include: [{ model: Companies, as: 'companyDetails' }],
        where: { date: { [Op.lte]: selectedDate } },
        order: [['companyId', 'ASC']]
      });

      const cumulativeEquipments = await WorkEquipments.findAll({
        include: [
          { model: Equipments, as: 'equipment' },
          { model: WorkDetails, as: 'workDetail', where: { date: { [Op.lte]: selectedDate } } }
        ],
        order: [['equipmentId', 'ASC']]
      });

      // 자재, 장비, 업체 각각 전일-금일-누계 데이터를 처리
      const groupedMaterials = {};
      const groupedEquipments = {};
      const groupedWorkDetails = {};

      // 모든 자재 기본 값 설정
      allMaterials.forEach(material => {
        const key = `${material.materialName}-${material.specification}`;
        groupedMaterials[key] = {
          materialDetails: material,
          previousQuantity: 0,
          currentQuantity: 0,
          totalQuantity: 0 // 누적 합계
        };
      });

      // 누적 자재 데이터 처리
      cumulativeMaterials.forEach(material => {
        const key = `${material.materialDetails.materialName}-${material.materialDetails.specification}`;
        if (groupedMaterials[key]) {
          groupedMaterials[key].totalQuantity += material.quantity; // 누적 합계
          if (material.date === selectedDate) {
            groupedMaterials[key].currentQuantity = material.quantity; // 금일 자재량
          } else if (material.date === formattedPreviousDate) {
            groupedMaterials[key].previousQuantity = material.quantity; // 전일 자재량
          }
        }
      });

      // 모든 장비 기본 값 설정
      allEquipments.forEach(equipment => {
        const key = `${equipment.equipmentName}-${equipment.specification}`;
        groupedEquipments[key] = {
          equipment: equipment,
          previousUsage: 0,
          currentUsage: 0,
          totalUsage: 0 // 누적 합계
        };
      });

      // 누적 장비 데이터 처리
      cumulativeEquipments.forEach(equipment => {
        const key = `${equipment.equipment.equipmentName}-${equipment.equipment.specification}`;
        
        // 동일한 장비가 여러 업체에서 사용된 경우, 사용량을 합산
        if (groupedEquipments[key]) {
          groupedEquipments[key].totalUsage += equipment.equipmentCount; // 누적 합계
          
          if (equipment.workDetail.date === selectedDate) {
            groupedEquipments[key].currentUsage += equipment.equipmentCount; // 금일 장비 사용량 합산
          } else if (equipment.workDetail.date === formattedPreviousDate) {
            groupedEquipments[key].previousUsage += equipment.equipmentCount; // 전일 사용량 합산
          }
        }
      });


      // 모든 업체 기본 값 설정
      allCompanies.forEach(company => {
        const key = `${company.company}-${company.trade}`;
        groupedWorkDetails[key] = {
          companyDetails: company,
          previousPersonnel: 0,
          currentPersonnel: 0,
          totalPersonnel: 0 // 누적 합계
        };
      });

      // 누적 업체 데이터 처리
      cumulativeWorkDetails.forEach(workDetail => {
        const key = `${workDetail.companyDetails.company}-${workDetail.companyDetails.trade}`;
        if (groupedWorkDetails[key]) {
          groupedWorkDetails[key].totalPersonnel += workDetail.personnel_count; // 누적 합계
          if (workDetail.date === selectedDate) {
            groupedWorkDetails[key].currentPersonnel = workDetail.personnel_count; // 금일 출력
          } else if (workDetail.date === formattedPreviousDate) {
            groupedWorkDetails[key].previousPersonnel = workDetail.personnel_count; // 전일 출력
          }
        }
      });

      // 각 workDetail에 대해 선택된 날짜의 금일 출력 계산
      Object.values(groupedWorkDetails).forEach(detail => {
        detail.calculatePersonnelForSelectedDate = detail.currentPersonnel;
      });

      // 선택된 날짜의 출력 인원만 계산하는 함수
      const calculatePersonnelForSelectedDate = (workDetails, selectedDate) => {
        return workDetails.reduce((total, workDetail) => {
          if (workDetail.date === selectedDate) {
            return total + workDetail.personnel_count;
          }
          return total;
        }, 0);
      };

      //ManpowerFinalPaper.ejs용

      const formatDate = (date) => new Date(date).toISOString().split('T')[0];  // 'YYYY-MM-DD' 형식으로 변환

      const totalPersonnelToday = cumulativeWorkDetails.reduce((total, work) => {
        if (formatDate(work.date) === formatDate(selectedDate)) {
          return total + work.personnel_count;
        }
        return total;
      }, 0);
      

      // 전일 출력 인원 합계 계산
      const totalPersonnelPreviousDay = cumulativeWorkDetails.reduce((total, work) => {
        if (work.date === formattedPreviousDate) {
          return total + work.personnel_count;
        }
        return total;
      }, 0);

      // 누적 출력 인원 합계 계산 (선택된 날짜까지)
      const totalPersonnelCumulative = cumulativeWorkDetails.reduce((total, work) => {

        return total + work.personnel_count;
        
      }, 0);
      
      // 총 출력할 행 수 계산
      const totalRows = Math.max(
        Object.values(groupedMaterials).length,
        Object.values(groupedEquipments).length,
        Object.values(groupedWorkDetails).length
      );

      // 빈칸 채우기 위해 필요한 행 수 계산
      const emptyRows = maxRows - totalRows;

      res.render('ManpowerFinalPaper', {
        siteName,
        workDate: selectedDate,
        weather,
        lowTemp,
        highTemp,
        materials: Object.values(groupedMaterials),
        equipments: Object.values(groupedEquipments),
        workDetails: Object.values(groupedWorkDetails),
        totalPersonnelToday,
        totalPersonnelPreviousDay,
        totalPersonnelCumulative,
        maxRows, // maxRows 전송
        emptyRows // 빈칸 채우기 위한 행 수
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send('Error fetching data');
    }
  });


// WorkStatusFinalPaper 라우트
app.get('/WorkStatusFinalPaper', async (req, res) => {
  try {

    const selectedDate = req.query.date || (() => {
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 9시간 더해 KST로 변환
      return koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환
    })();

    const previousDate = new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1));
    
    // 데이터베이스에서 WorkStatusFinalPaper의 maxRows 값 불러오기
    const maxRowsSetting = await MaxRows.findOne({ where: { pageName: 'WorkStatusFinalPaper' } });
    const maxRows = maxRowsSetting ? maxRowsSetting.maxRows : 50; // 값이 없으면 기본값 50

    // 현장명을 데이터베이스에서 가져오기
    const site = await Site.findOne(); // 가장 첫 번째 현장명을 가져오는 예시입니다.
    const siteName = site ? site.siteName : "공사명"; // 만약 데이터가 없으면 기본값으로 "공사명" 사용

    //날씨
    // 날씨 데이터 가져오기
    let weatherData = await Weather.findOne({ where: { date: selectedDate } });

    if (!weatherData) {
      // 선택한 날짜가 오늘이라면, API를 호출하여 날씨 데이터를 가져옵니다.
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        await getWeatherData();
        weatherData = await Weather.findOne({ where: { date: selectedDate } });
      } else {
        console.log(`${selectedDate}의 날씨 데이터가 없습니다.`);
      }
    }

    const weather = weatherData ? weatherData.weatherCondition : '정보 없음';
    const lowTemp = weatherData ? `${weatherData.minTemp} °C` : '정보 없음';
    const highTemp = weatherData ? `${weatherData.maxTemp} °C` : '정보 없음';


    // 금일 작업사항
    let workDetails = await WorkDetails.findAll({
      include: [{ model: Companies, as: 'companyDetails' }],
      where: { date: selectedDate },
      attributes: ['id', 'description', 'companyId'] // 'id' 필드 추가
    });

    // 전일 작업사항
    let previousWorkDetails = await WorkDetails.findAll({
      include: [{ model: Companies, as: 'companyDetails' }],
      where: { date: previousDate.toISOString().split('T')[0] },
      attributes: ['id', 'description', 'companyId'] // 'id' 필드 추가
    });

    // 금일 작업사항을 업체명 기준으로 정렬
    workDetails = workDetails.sort((a, b) => {
      const companyA = a.companyDetails.company.toUpperCase();
      const companyB = b.companyDetails.company.toUpperCase();
      return companyA.localeCompare(companyB); // 알파벳 순으로 정렬
    });

    // 전일 작업사항을 업체명 기준으로 정렬
    previousWorkDetails = previousWorkDetails.sort((a, b) => {
      const companyA = a.companyDetails.company.toUpperCase();
      const companyB = b.companyDetails.company.toUpperCase();
      return companyA.localeCompare(companyB); // 알파벳 순으로 정렬
    });

    // 렌더링할 템플릿에 필요한 데이터 전달
    res.render('WorkStatusFinalPaper', {
      siteName,
      workDate: selectedDate,
      weather,
      lowTemp,
      highTemp,
      workDetails, // 선택된 날짜의 작업 현황
      previousWorkDetails, // 전일 작업 현황
      maxRows, // 필요 시 사용
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});



// app.js 또는 서버 메인 파일에서
app.post('/update-work-description', async (req, res) => {
  const { workId, description } = req.body;

  console.log(`Received request to update workId: ${workId} with description: ${description}`);

  try {
      // 데이터베이스에서 해당 workId에 대한 description을 업데이트
      await WorkDetails.update({ description }, { where: { id: workId } });

      console.log('작업 내용이 성공적으로 업데이트되었습니다.');
      res.status(200).json({ message: '작업 내용이 성공적으로 업데이트되었습니다.' });
  } catch (error) {
      console.error('작업 내용 업데이트 중 오류 발생:', error);
      res.status(500).json({ message: '작업 내용 업데이트 중 오류가 발생했습니다.' });
  }
});



async function updateWorkDescription(workId, newDescription) {
  console.log(`Updating work description for workId: ${workId} with description: ${newDescription}`);
  try {
      const response = await fetch('/update-work-description', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ workId, description: newDescription }),
      });

      if (response.ok) {
          console.log('작업 내용이 성공적으로 업데이트되었습니다.');
      } else {
          console.error('작업 내용 업데이트에 실패했습니다.');
      }
  } catch (error) {
      console.error('작업 내용 업데이트 중 오류가 발생했습니다:', error);
  }
}



//날씨 api
// 날씨 데이터베이스 초기화 라우트 추가
app.get('/reset-weather-database', async (req, res) => {
  try {
    await Weather.sync({ force: true });
    console.log('Weather table has been reset and recreated!');
    res.send('날씨 데이터베이스가 초기화되었습니다.');
  } catch (error) {
    console.error('Error resetting the weather table:', error);
    res.status(500).send('날씨 데이터베이스 초기화 중 오류가 발생했습니다.');
  }
});




// 기존의 getWeatherData 함수 수정
async function getWeatherData() {
  const serviceKey = '5d%2FuSBS9DyxFodVGV5jsPfu2rnCycumgAN4iHkwDqA79ETt3Ss1fLHghWNlacVFufLTHj8R53ON%2FZULQbPKhEQ%3D%3D'; // 발급받은 서비스 키를 입력하세요.
  const decodedServiceKey = decodeURIComponent(serviceKey); // 서비스 키 디코딩
  const url = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

  // 현재 날짜와 시간을 구합니다.
  const date = new Date();
  let baseDate = date.toISOString().split('T')[0].replace(/-/g, '');
  let hours = date.getHours();

  // API 제공 시간에 맞게 baseTime 설정
  let baseTime;
  if (hours >= 2 && hours < 5) {
    baseTime = '0200';
  } else if (hours >= 5 && hours < 8) {
    baseTime = '0500';
  } else if (hours >= 8 && hours < 11) {
    baseTime = '0800';
  } else if (hours >= 11 && hours < 14) {
    baseTime = '1100';
  } else if (hours >= 14 && hours < 17) {
    baseTime = '1400';
  } else if (hours >= 17 && hours < 20) {
    baseTime = '1700';
  } else if (hours >= 20 && hours < 23) {
    baseTime = '2000';
  } else {
    baseTime = '2300';
    // 자정 이후에는 baseDate를 전날로 변경
    baseDate = new Date(date.setDate(date.getDate() - 1)).toISOString().split('T')[0].replace(/-/g, '');
  }

  // 수원시의 격자 좌표
  const nx = 60;
  const ny = 121;

  const queryParams = '?' + querystring.stringify({
    ServiceKey: decodedServiceKey,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: nx,
    ny: ny,
  });

  try {
    const response = await axios.get(url + queryParams);
    const items = response.data.response.body.items.item;

    // 필요한 데이터 필터링
    const weatherData = {};

    items.forEach(item => {
      if (item.category === 'TMN') {
        weatherData.minTemp = item.fcstValue; // 최저기온
      }
      if (item.category === 'TMX') {
        weatherData.maxTemp = item.fcstValue; // 최고기온
      }
      if (item.category === 'SKY' && !weatherData.weatherCondition) {
        const skyStatus = {
          '1': '맑음',
          '3': '구름 많음',
          '4': '흐림',
        };
        weatherData.weatherCondition = skyStatus[item.fcstValue];
      }
      if (item.category === 'PTY' && item.fcstValue !== '0') {
        const ptyStatus = {
          '1': '비',
          '2': '비/눈',
          '3': '눈',
          '4': '소나기',
        };
        weatherData.weatherCondition = ptyStatus[item.fcstValue];
      }
    });

    // 날짜를 'YYYY-MM-DD' 형식으로 변환
    const today = new Date().toISOString().split('T')[0];

    // Weather 테이블에 데이터 저장
    await Weather.create({
      date: today,
      minTemp: weatherData.minTemp || '-',
      maxTemp: weatherData.maxTemp || '-',
      weatherCondition: weatherData.weatherCondition || '정보 없음',
    });

    console.log('날씨 데이터가 데이터베이스에 저장되었습니다.');

    return weatherData;
  } catch (error) {
    console.error('API 호출 중 오류 발생:', error);
    return null;
  }
}

// 날씨 데이터 업데이트 라우트
app.post('/update-weather', async (req, res) => {
  const { weather } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
      // 오늘의 날씨 데이터를 데이터베이스에서 찾습니다.
      const weatherData = await Weather.findOne({ where: { date: today } });

      if (!weatherData) {
          return res.status(404).send('오늘의 날씨 데이터가 없습니다.');
      }

      // 날씨 데이터를 업데이트합니다.
      weatherData.weatherCondition = weather;
      await weatherData.save();

      res.status(200).send('날씨가 성공적으로 업데이트되었습니다.');
  } catch (error) {
      console.error('Error updating weather:', error);
      res.status(500).send('날씨 업데이트 중 오류가 발생했습니다.');
  }
});

//현장명 관리

// 현장명 관리 페이지 라우트
app.get('/manage-sites', async (req, res) => {
  const sites = await Site.findAll({ order: [['siteName', 'ASC']] });
  res.render('manage', { sites });
});

// 현장명 추가 처리
app.post('/add-site', async (req, res) => {
  const { siteName } = req.body;
  await Site.create({ siteName });
  res.redirect('/manage');
});

// 현장명 수정 처리
app.post('/update-site/:id', async (req, res) => {
  const { id } = req.params;
  const { siteName } = req.body;
  await Site.update({ siteName }, { where: { id } });
  res.redirect('/manage');
});

// 현장명 삭제 처리
app.post('/delete-site/:id', async (req, res) => {
  const { id } = req.params;
  await Site.destroy({ where: { id } });
  res.redirect('/manage');
});

//기상청 api 넣기
// API 키 추가
app.post('/add-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    await APIKeys.create({ apiKey });
    res.redirect('/manage'); // 성공적으로 추가 후 manage 페이지로 리다이렉트
  } catch (error) {
    console.error('Error adding API key:', error);
    res.status(500).send('API 키 추가 중 오류가 발생했습니다.');
  }
});

// API 키 수정
app.post('/update-api-key/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;
    await APIKeys.update({ apiKey }, { where: { id } });
    res.redirect('/manage'); // 성공적으로 수정 후 manage 페이지로 리다이렉트
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).send('API 키 수정 중 오류가 발생했습니다.');
  }
});

// API 키 삭제
app.post('/delete-api-key/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await APIKeys.destroy({ where: { id } });
    res.redirect('/manage'); // 성공적으로 삭제 후 manage 페이지로 리다이렉트
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).send('API 키 삭제 중 오류가 발생했습니다.');
  }
});

/*sqlite를 직접 다운로드*/

// 현장명 가져오기 (데이터베이스에서)
const getSiteName = async () => {
  try {
    const site = await Site.findOne(); // 현장명 데이터베이스에서 가져오기
    return site ? site.siteName : 'UnknownSite'; // 현장명이 없을 경우 'UnknownSite'
  } catch (error) {
    console.error('Error fetching site name:', error);
    return 'UnknownSite'; // 에러 발생 시 기본값 반환
  }
};

// SQLite DB 파일 다운로드 라우트
app.get('/download-sqlite', async (req, res) => {
  const dbPath = path.join(__dirname, 'database.sqlite'); // SQLite DB 파일 경로

  // 파일이 존재하는지 확인
  fs.access(dbPath, fs.constants.F_OK, async (err) => {
    if (err) {
      console.error('SQLite 파일이 존재하지 않습니다:', err);
      return res.status(404).send('SQLite 파일을 찾을 수 없습니다.');
    }

    // 날짜 가져오기
    const currentDate = new Date().toISOString().split('T')[0]; // 현재 날짜 (YYYY-MM-DD 형식)

    // 현장명 가져오기
    const siteName = await getSiteName();

    // 파일 이름을 "database_YYYY-MM-DD_현장명.sqlite"로 설정
    const fileName = `database_${currentDate}_${siteName}.sqlite`;

    // 파일 다운로드 제공
    res.download(dbPath, fileName, (err) => {
      if (err) {
        console.error('파일 전송 중 오류가 발생했습니다:', err);
        res.status(500).send('파일을 전송하는 중 오류가 발생했습니다.');
      }
    });
  });
});

// maxRows 값 변경 API
app.post('/update-max-rows', async (req, res) => {
  const { pageName, maxRows } = req.body;

  try {
    // 페이지 이름에 해당하는 maxRows 값을 업데이트
    const maxRowsSetting = await MaxRows.findOne({ where: { pageName } });
    if (maxRowsSetting) {
      // 기존 값 업데이트
      maxRowsSetting.maxRows = maxRows;
      await maxRowsSetting.save();
    } else {
      // 새로 추가
      await MaxRows.create({ pageName, maxRows });
    }

    res.status(200).json({ message: 'maxRows 값이 업데이트되었습니다.' });
  } catch (error) {
    console.error('Error updating maxRows:', error);
    res.status(500).json({ message: 'maxRows 업데이트 중 오류가 발생했습니다.' });
  }
});

// 업체 순서 관리 페이지
app.get('/manage-company-order', async (req, res) => {
  const companies = await Companies.findAll({
    order: [['order', 'ASC']],
  });
  res.render('manageCompanyOrder', { companies });
});

// 업체 순서 업데이트 API
app.post('/update-company-order', async (req, res) => {
  const { companyOrders } = req.body; // [{ id: 1, order: 1 }, { id: 2, order: 2 }, ...]

  try {
    for (const companyOrder of companyOrders) {
      await Companies.update(
        { order: companyOrder.order },
        { where: { id: companyOrder.id } }
      );
    }
    res.status(200).json({ message: '업체 순서가 업데이트되었습니다.' });
  } catch (error) {
    console.error('업체 순서 업데이트 중 오류 발생:', error);
    res.status(500).json({ message: '업체 순서 업데이트 중 오류가 발생했습니다.' });
  }
});

app.get('/WorkStatusForSmaty', async (req, res) => {
  try {
    const selectedDate = req.query.date || (() => {
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // KST로 변환
      return koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환
    })();

    // 데이터베이스에서 WorkStatusFinalPaper의 maxRows 값 불러오기
    const maxRowsSetting = await MaxRows.findOne({ where: { pageName: 'WorkStatusForSmaty' } });
    const maxRows = maxRowsSetting ? maxRowsSetting.maxRows : 50; // 기본값 50

    // 현장명과 작업 내역을 데이터베이스에서 가져오기
    const site = await Site.findOne(); // 첫 번째 현장명을 가져오는 예시
    const siteName = site ? site.siteName : "공사명"; // 데이터가 없을 경우 기본값 "공사명"

    // 금일 작업사항
    let workDetails = await WorkDetails.findAll({
      include: [{ model: Companies, as: 'companyDetails' }],
      where: { date: selectedDate },
      attributes: ['id', 'description', 'companyId']
    });

    // 금일 작업사항을 업체명 기준으로 정렬
    workDetails = workDetails.sort((a, b) => {
      const companyA = a.companyDetails.company.toUpperCase();
      const companyB = b.companyDetails.company.toUpperCase();
      return companyA.localeCompare(companyB); // 알파벳 순으로 정렬
    });

    // 렌더링할 템플릿에 필요한 데이터 전달
    res.render('WorkStatusForSmaty', {
      siteName,
      workDate: selectedDate,
      workDetails, // 선택된 날짜의 작업 현황
      maxRows, // 필요 시 사용
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});


//한페이지
// CombinedFinalPaper 라우트
app.get('/CombinedFinalPaper', async (req, res) => {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
    const previousDate = new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1));
    const formattedPreviousDate = previousDate.toISOString().split('T')[0];

    // 현장명 가져오기
    const site = await Site.findOne();
    const siteName = site ? site.siteName : "공사명";

    // 날씨 데이터 가져오기
    let weatherData = await Weather.findOne({ where: { date: selectedDate } });
    if (!weatherData && selectedDate === new Date().toISOString().split('T')[0]) {
      await getWeatherData();
      weatherData = await Weather.findOne({ where: { date: selectedDate } });
    }

    const weather = weatherData ? weatherData.weatherCondition : '정보 없음';
    const lowTemp = weatherData ? `${weatherData.minTemp} °C` : '정보 없음';
    const highTemp = weatherData ? `${weatherData.maxTemp} °C` : '정보 없음';

    // 금일 및 전일 작업사항 가져오기
    const workDetails = await WorkDetails.findAll({
      include: [{ model: Companies, as: 'companyDetails' }],
      where: { date: selectedDate },
      attributes: ['id', 'description', 'companyId', 'personnel_count']
    });

    const previousWorkDetails = await WorkDetails.findAll({
      include: [{ model: Companies, as: 'companyDetails' }],
      where: { date: formattedPreviousDate },
      attributes: ['id', 'description', 'companyId', 'personnel_count']
    });

    // 모든 업체 가져오기
    const allCompanies = await Companies.findAll({
      order: [['order', 'ASC']],
      include: [{ model: WorkDetails, as: 'workDetails', where: { date: selectedDate }, required: false }]
    });

    // 자재 및 장비 현황 데이터 가져오기
    const materials = await DailyMaterials.findAll({
      include: [{ model: Materials, as: 'materialDetails' }],
      where: { date: selectedDate },
      order: [['materialId', 'ASC']]
    });

    const equipmentDetails = await WorkEquipments.findAll({
      include: [
        { model: Equipments, as: 'equipment' },
        { model: WorkDetails, as: 'workDetail', where: { date: selectedDate }, include: [{ model: Companies, as: 'companyDetails' }] }
      ],
      order: [['equipmentId', 'ASC']]
    });

    // 데이터 정렬
    workDetails.sort((a, b) => a.companyDetails.company.localeCompare(b.companyDetails.company, 'ko'));
    previousWorkDetails.sort((a, b) => a.companyDetails.company.localeCompare(b.companyDetails.company, 'ko'));

    // 출력 현황 데이터 가공 (manpowerDetails 대체)
    const groupedWorkDetails = allCompanies.map(company => {
      const workDetail = company.workDetails[0];
      return {
        companyDetails: company,
        previousPersonnel: workDetail ? workDetail.personnel_count : 0,
        totalPersonnel: workDetail ? workDetail.personnel_count : 0
      };
    });

    // 누적 자재 및 장비 데이터 처리
    const groupedMaterials = {};
    const groupedEquipments = {};

    materials.forEach(material => {
      const key = `${material.materialDetails.materialName}-${material.materialDetails.specification}`;
      if (!groupedMaterials[key]) {
        groupedMaterials[key] = {
          materialDetails: material,
          inQuantity: 0,
          outQuantity: 0
        };
      }
    });

    equipmentDetails.forEach(equipment => {
      const key = `${equipment.equipment.equipmentName}-${equipment.equipment.specification}`;
      if (!groupedEquipments[key]) groupedEquipments[key] = { equipmentDetails: equipment, equipmentCount: 0 };
    });

    // **변경 사항**: `manpowerDetails` 대신 `groupedWorkDetails` 변수를 전달
    res.render('CombinedFinalPaper', {
      selectedDate,
      siteName,
      weather,
      lowTemp,
      highTemp,
      previousWorkDetails,
      workDetails,
      groupedWorkDetails: groupedWorkDetails, // 정의된 `groupedWorkDetails`를 전달
      groupedMaterials: Object.values(groupedMaterials),
      groupedEquipments: Object.values(groupedEquipments)
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});



app.post('/update-personnel-count/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { personnel_count } = req.body;
  const selectedDate = new Date().toISOString().split('T')[0]; // 현재 날짜 사용

  try {
    // 해당 업체의 해당 날짜의 WorkDetails 레코드를 업데이트하거나 생성합니다.
    let workDetail = await WorkDetails.findOne({ where: { companyId, date: selectedDate } });

    if (workDetail) {
      // 기존 레코드 업데이트
      await WorkDetails.update({ personnel_count }, { where: { id: workDetail.id } });
    } else {
      // 새로운 레코드 생성
      await WorkDetails.create({ companyId, date: selectedDate, personnel_count });
    }

    res.status(200).send('인원 수가 업데이트되었습니다.');
  } catch (error) {
    console.error('인원 수 업데이트 중 오류 발생:', error);
    res.status(500).send('인원 수 업데이트 중 오류가 발생했습니다.');
  }
});




// 서버 실행
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
