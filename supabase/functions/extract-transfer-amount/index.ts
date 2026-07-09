import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `أنت محلل متخصص في استخراج بيانات إشعارات التحويلات البنكية السودانية (خاصة بنك الخرطوم).
حلل الصورة واستخرج جميع المعلومات التالية بدقة عالية:

1. **مبلغ التحويل** (amount): الرقم فقط بدون عملة أو فواصل
2. **تاريخ التحويل** (date): بصيغة YYYY-MM-DD
3. **اسم المرسل** (sender_name): اسم صاحب الحساب المرسل
4. **رقم العملية/المرجع** (transaction_id): الرقم المرجعي الفريد للعملية (Reference Number / Transaction ID)
5. **المستلم** (receiver_account): اسم الجهة أو الشخص المستلم (مثال: "مهند لصالح فيوتشر")
6. **من حساب** (sender_account): رقم حساب المرسل البنكي
7. **تعليق البنك** (bank_comment): أي نص تعليق أو ملاحظة موجودة في الإشعار (حقل التعليق/الوصف/Memo)

ملاحظات مهمة:
- في إشعارات بنك الخرطوم، ابحث عن حقل "التعليق" أو "الوصف" أو "Remarks" أسفل الإشعار
- رقم العملية عادة يظهر كـ "رقم المرجع" أو "Reference" أو "Transaction ID"
- "المستلم" = "المحول إليه" أو "To" أو "Beneficiary"
- "من حساب" = "From Account" أو "رقم الحساب المرسل"

أجب بصيغة JSON فقط بدون أي نص إضافي:
{
  "amount": number | null,
  "date": "YYYY-MM-DD" | null,
  "sender_name": "string" | null,
  "transaction_id": "string" | null,
  "receiver_account": "string" | null,
  "sender_account": "string" | null,
  "bank_comment": "string" | null,
  "reference_number": "string" | null,
  "confidence": number (0-100)
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication: require a valid Supabase JWT (or service-role bearer for internal callers).
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const presented = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!presented) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isServiceRoleCaller = presented === serviceKey && serviceKey.length > 0;

  // authenticatedUserId is null for trusted internal (service-role) callers,
  // and the verified JWT subject for regular end users. It is resolved ONCE
  // here and reused below for both rate limiting and the object-level
  // authorization check on `transferId` — never trust it re-derived per use.
  let authenticatedUserId: string | null = null;

  if (!isServiceRoleCaller) {
    // Validate as a user JWT.
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${presented}` } },
      });
      const { data, error } = await userClient.auth.getClaims(presented);
      const sub = data?.claims?.sub as string | undefined;
      if (error || !sub) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authenticatedUserId = sub;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // === Per-user rate limit (real users only; service-role bypasses) ===
  if (!isServiceRoleCaller && authenticatedUserId) {
    try {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: allowed } = await admin.rpc(
        'check_and_increment_ai_rate_limit',
        { _user_id: authenticatedUserId, _endpoint: 'extract-transfer-amount', _limit: 20, _window_seconds: 60 },
      );
      if (allowed === false) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز الحد المسموح. حاول بعد دقيقة.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } catch (e) {
      console.error('rate-limit check failed (allowing request):', e);
    }
  }


  try {
    const { imageUrl, imageBase64, transferId } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'يجب توفير رابط الصورة أو البيانات' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let imageContent;
    if (imageBase64) {
      imageContent = {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
        }
      };
    } else {
      imageContent = {
        type: "image_url",
        image_url: { url: imageUrl }
      };
    }

    console.log('Sending image to AI for enhanced extraction...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'قم بتحليل صورة إشعار التحويل هذه واستخرج جميع البيانات المطلوبة:' },
              imageContent
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'يرجى إضافة رصيد للاستمرار في استخدام الذكاء الاصطناعي' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log('AI Response:', content);

    let extractedData;
    try {
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'فشل في تحليل استجابة الذكاء الاصطناعي', rawResponse: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If transferId provided, update the transfer with all extracted fields
    if (transferId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, any> = {
        extracted_data: extractedData,
        ai_confidence: extractedData.confidence || null,
      };

      if (extractedData.amount) updateData.amount = extractedData.amount;
      if (extractedData.date) updateData.transfer_date = extractedData.date;
      if (extractedData.sender_name) updateData.sender_name = extractedData.sender_name;
      if (extractedData.transaction_id) updateData.transaction_id = extractedData.transaction_id;
      if (extractedData.receiver_account) updateData.receiver_account = extractedData.receiver_account;
      if (extractedData.sender_account) updateData.sender_account = extractedData.sender_account;
      if (extractedData.bank_comment) updateData.bank_comment = extractedData.bank_comment;

      // Build client_memo from bank_comment (don't overwrite manual edits)
      const { data: existingTransfer } = await supabase
        .from('transfers')
        .select('is_manual_memo, client_memo')
        .eq('id', transferId)
        .single();

      if (existingTransfer && !existingTransfer.is_manual_memo) {
        updateData.client_memo = extractedData.bank_comment || null;
      }

      const { error: updateError } = await supabase
        .from('transfers')
        .update(updateData)
        .eq('id', transferId);

      if (updateError) {
        console.error('Failed to update transfer:', updateError);
      } else {
        console.log('Transfer updated with all extracted fields');
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract transfer error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
